// ============================================================================
// "Solicitar cita" — dentro de la conversación.
//
// Es el ÚNICO sitio donde se pide una cita. El panel del paciente enlaza aquí
// en vez de repetir el formulario: dos formas de pedir lo mismo acaban siendo
// dos comportamientos distintos.
//
// ── Horas en punto y una hora fija ──────────────────────────────────────────
//
// Cada cita ocupa exactamente una hora: 45 minutos de consulta y 15 para dejar
// la evolución escrita. Ese cuarto de hora no es holgura, es parte del trabajo,
// así que no se ofrece como opción ni se puede recortar.
//
// Por eso no hay selector de minutos ni de duración: se elige día y hora en
// punto, y el bloque va de esa hora a la siguiente. Si hay una cita a las 09:00,
// el siguiente hueco es a las 10:00 — no las 09:45 ni las 09:30.
//
// ── Solo se ofrecen horas libres ────────────────────────────────────────────
//
// La lista de horas la contesta la base, no el cliente: cruza sesiones
// clínicas, citas vivas y la franja que el profesional declaró, con la MISMA
// comprobación que impide el solapamiento al insertar. Elegir a ciegas y
// descubrir al enviar que la hora estaba ocupada es una forma barata de hacer
// que alguien desista de pedir cita.
//
// Esto no sustituye la validación: quien impide de verdad el solapamiento sigue
// siendo PostgreSQL. Entre que se pinta la lista y se envía el formulario cabe
// otra cita, y ese caso lo resuelve el servidor y se muestra su mensaje.
// ============================================================================
import { useEffect, useState } from "react";
import { CalendarPlus, Loader2 } from "lucide-react";
import { listAvailableHours, requestAppointment } from "../../lib/api";

/** Una cita ocupa siempre esto. No es configurable. */
const DURACION_MINUTOS = 60;

const dosDigitos = (n: number) => String(n).padStart(2, "0");

const etiquetaHora = (iso: string) => {
  const d = new Date(iso);
  const fin = new Date(d.getTime() + DURACION_MINUTOS * 60000);
  const hm = (x: Date) => `${dosDigitos(x.getHours())}:${dosDigitos(x.getMinutes())}`;
  return `${hm(d)} – ${hm(fin)}`;
};

/** Hoy en formato `YYYY-MM-DD`, en hora local. Sirve de mínimo del calendario. */
function hoyLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;
}

export function SolicitarCita({
  relationshipId,
  onSolicitada,
}: {
  relationshipId: string;
  onSolicitada?: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [dia, setDia] = useState("");
  const [hora, setHora] = useState("");
  const [notas, setNotas] = useState("");
  const [libres, setLibres] = useState<string[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  // Al cambiar de día se piden sus horas libres. El testigo `vigente` descarta la
  // respuesta de un día que ya no está seleccionado: si alguien cambia la fecha
  // dos veces seguidas, la primera petición puede llegar después.
  useEffect(() => {
    if (!dia) {
      setLibres([]);
      return;
    }
    let vigente = true;
    setBuscando(true);
    setHora("");
    void listAvailableHours(relationshipId, dia)
      .then((horas) => {
        if (vigente) setLibres(horas);
      })
      .finally(() => {
        if (vigente) setBuscando(false);
      });
    return () => {
      vigente = false;
    };
  }, [relationshipId, dia]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!dia || !hora) return;

    setEnviando(true);
    setAviso(null);
    try {
      const inicio = new Date(hora);
      const fin = new Date(inicio.getTime() + DURACION_MINUTOS * 60000);

      await requestAppointment(relationshipId, inicio.toISOString(), fin.toISOString(), notas);
      setAviso({ tipo: "ok", texto: "Cita solicitada. Te avisaremos cuando la confirmen." });
      setDia("");
      setHora("");
      setNotas("");
      onSolicitada?.();
    } catch (err) {
      setAviso({
        tipo: "error",
        texto: err instanceof Error ? err.message : "No se pudo solicitar la cita.",
      });
    } finally {
      setEnviando(false);
    }
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-primary/20 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/10"
      >
        <CalendarPlus size={15} /> Solicitar cita
      </button>
    );
  }

  return (
    <form onSubmit={enviar} className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <p className="text-sm font-bold text-primary">Solicitar cita</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Las citas duran una hora y empiezan siempre en punto. Solo aparecen las horas que el
        profesional tiene libres.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Día</span>
          <input
            type="date"
            value={dia}
            min={hoyLocal()}
            onChange={(e) => setDia(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Hora</span>
          <select
            value={hora}
            disabled={!dia || buscando || libres.length === 0}
            onChange={(e) => setHora(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">
              {!dia ? "Elige primero un día" : buscando ? "Buscando horas…" : "Elige una hora"}
            </option>
            {libres.map((h) => (
              <option key={h} value={h}>
                {etiquetaHora(h)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {dia && buscando && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="animate-spin" size={12} /> Consultando la agenda…
        </p>
      )}
      {dia && !buscando && libres.length === 0 && (
        <p className="mt-2 text-xs text-amber-700">
          Ese día no queda ninguna hora libre. Prueba con otra fecha.
        </p>
      )}

      <label className="mt-3 block">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Algo que quieras adelantar (opcional)
        </span>
        <textarea
          rows={2}
          maxLength={1000}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          className="mt-1 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
      </label>

      {aviso && (
        <p className={`mt-3 text-sm ${aviso.tipo === "ok" ? "text-emerald-600" : "text-red-600"}`}>
          {aviso.texto}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={enviando || !dia || !hora}
          className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {enviando ? "Enviando…" : "Solicitar"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600"
        >
          Cerrar
        </button>
      </div>
    </form>
  );
}
