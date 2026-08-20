// ============================================================================
// MatchingPreview — vista mínima del resultado del Matching Clínico.
//
// NO es la interfaz final: no hay diseño, no hay foto grande, no hay CTA de
// agenda. Es lo justo para poder ver qué devuelve el motor y por qué, que es
// lo único que este sprint necesita.
//
// Muestra la explicación junto al resultado a propósito: un score suelto no
// dice nada, y derivar a alguien a un profesional sin poder enseñar el criterio
// es exactamente lo que este motor existe para no hacer.
//
// Si no hay match, no se dibuja nada. Con los datos de hoy —el perfil
// profesional todavía no tiene especialidades, idiomas ni modalidad en la
// base— ese es el caso normal.
// ============================================================================
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createContactRequest,
  getMyTherapist,
  listPatientRequests,
  type MyTherapist,
  matchTherapists,
  trackEvent,
  type ContactRequestStatus,
  type MatchingInput,
  type TherapistMatch,
} from "../../lib/api";

const ETIQUETA_CRITERIO: Record<string, string> = {
  especialidad: "Especialidad",
  motivo: "Motivo de consulta",
  idioma: "Idioma",
  modalidad: "Modalidad",
  disponibilidad: "Disponibilidad",
};

export function MatchingPreview({ input, max }: { input: MatchingInput; max?: number }) {
  const [matches, setMatches] = useState<TherapistMatch[]>([]);
  /** Estado de la solicitud por terapeuta, si ya existe alguna. */
  const [solicitudes, setSolicitudes] = useState<Record<string, ContactRequestStatus>>({});
  const [terapeutaAsignado, setTerapeutaAsignado] = useState<MyTherapist | null>(null);
  const [error, setError] = useState<string | null>(null);
  const registrado = useRef<string | null>(null);

  // Se carga una vez: qué se ha pedido ya decide qué botón se ofrece. Solo
  // llegan las solicitudes propias — la función de la base filtra por sesión.
  const cargarSolicitudes = useCallback(async () => {
    const propias = await listPatientRequests();
    const porTerapeuta: Record<string, ContactRequestStatus> = {};
    for (const s of propias) {
      // Las más recientes primero: la primera que aparece es la que manda.
      if (!porTerapeuta[s.therapistProfileId]) porTerapeuta[s.therapistProfileId] = s.status;
    }
    setSolicitudes(porTerapeuta);
  }, []);

  useEffect(() => {
    void cargarSolicitudes();
  }, [cargarSolicitudes]);

  // Con terapeuta asignado no se ofrecen más: sugerir alternativas a quien ya
  // está en proceso es empujarlo a cambiar de profesional, y eso no es una
  // recomendación. El algoritmo no cambia — simplemente no se muestra.
  useEffect(() => {
    let vigente = true;
    void getMyTherapist().then((r) => {
      if (vigente) setTerapeutaAsignado(r);
    });
    return () => {
      vigente = false;
    };
  }, []);

  async function solicitar(therapistProfileId: string) {
    setError(null);
    try {
      await createContactRequest(therapistProfileId);
      await cargarSolicitudes();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar la solicitud.");
    }
  }

  // La entrada es un objeto nuevo en cada render; se compara por contenido.
  const clave = JSON.stringify(input);

  useEffect(() => {
    let vigente = true;
    void matchTherapists(JSON.parse(clave) as MatchingInput).then((r) => {
      // El motor ya devuelve como máximo 3; `max` solo recorta más, para el
      // sitio donde la pregunta es "quién" y no "entre quiénes".
      if (vigente) setMatches(max ? r.slice(0, max) : r);
    });
    return () => {
      vigente = false;
    };
  }, [clave, max]);

  // El guard evita el doble registro de StrictMode, igual que en el resto de
  // bloques que registran una impresión.
  useEffect(() => {
    if (matches.length === 0) return;
    if (registrado.current === clave) return;
    registrado.current = clave;
    trackEvent("MATCHING_SHOWN", {
      count: matches.length,
      // El criterio que decidió el primero. Nunca el motivo de consulta en sí.
      rule: matches[0].coincidencias[0] ?? "sin-criterio",
    });
  }, [matches, clave]);

  if (terapeutaAsignado) {
    return (
      <section className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <p className="text-sm font-bold text-emerald-800">Ya tienes un terapeuta asignado</p>
        <p className="mt-1 text-sm text-emerald-700">
          Estás en proceso con {terapeutaAsignado.therapistName}.
        </p>
      </section>
    );
  }

  if (matches.length === 0) return null;

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 p-5">
      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
        Profesionales sugeridos
      </h2>

      <ul className="mt-4 space-y-3">
        {matches.map((m) => (
          <li key={m.therapistId} className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-bold text-slate-900">{m.nombre || "Sin nombre"}</span>
              <span className="text-xs font-semibold text-slate-500">score {m.score}</span>
            </div>

            <p className="mt-1 text-xs text-slate-600">
              Coincide en: {m.coincidencias.map((c) => ETIQUETA_CRITERIO[c] ?? c).join(" · ")}
            </p>

            <AccionContacto
              therapistProfileId={m.therapistId}
              estado={solicitudes[m.therapistId] ?? null}
              onSolicitar={() => {
                trackEvent("MATCHING_SELECTED", {
                  resource_id: m.therapistId,
                  resource_type: "terapeuta",
                  score: m.score,
                  rule: m.coincidencias[0] ?? "sin-criterio",
                });
                return solicitar(m.therapistId);
              }}
            />
          </li>
        ))}
      </ul>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}

/**
 * El único control del bloque, con tres formas según dónde esté la solicitud.
 *
 * Pendiente sale deshabilitado a propósito: insistir no acelera nada y el
 * servidor rechazaría la segunda de todos modos.
 */
function AccionContacto({
  estado,
  onSolicitar,
}: {
  therapistProfileId: string;
  estado: ContactRequestStatus | null;
  onSolicitar: () => Promise<void>;
}) {
  const [enviando, setEnviando] = useState(false);

  if (estado === "pending") {
    return (
      <button
        type="button"
        disabled
        className="mt-3 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-400"
      >
        Solicitud enviada
      </button>
    );
  }

  if (estado === "accepted") {
    // La conversación todavía no existe: se deja el estado preparado, no un
    // enlace que llevaría a ninguna parte.
    return (
      <button
        type="button"
        disabled
        title="La conversación estará disponible próximamente"
        className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"
      >
        Ir a conversación
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={enviando}
      onClick={async () => {
        setEnviando(true);
        await onSolicitar();
        setEnviando(false);
      }}
      className="mt-3 rounded-lg border border-primary/30 px-3 py-1.5 text-xs font-bold text-primary disabled:opacity-60"
    >
      {enviando ? "Enviando…" : "Solicitar contacto"}
    </button>
  );
}
