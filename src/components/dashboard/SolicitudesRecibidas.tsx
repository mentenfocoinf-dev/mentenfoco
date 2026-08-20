// ============================================================================
// Solicitudes recibidas — panel del terapeuta.
//
// Funcional, sin diseño elaborado. Solo llegan las dirigidas a quien tiene la
// sesión abierta: lo filtra la función de la base, no esta pantalla.
//
// Aceptar y rechazar son las dos únicas acciones, y solo sobre lo pendiente.
// Una solicitud resuelta se queda a la vista con su estado — no se borra ni se
// esconde: que alguien pidiera ayuda y qué se respondió es información que
// importa.
// ============================================================================
import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  acceptContactRequest,
  listTherapistRequests,
  rejectContactRequest,
  CONTACT_STATUS_LABELS,
  type TherapistContactRequest,
} from "../../lib/api";

const CLASE_ESTADO: Record<string, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  accepted: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-slate-200 bg-slate-50 text-slate-600",
  cancelled: "border-slate-200 bg-slate-50 text-slate-500",
};

export function SolicitudesRecibidas() {
  const [solicitudes, setSolicitudes] = useState<TherapistContactRequest[]>([]);
  const [cargando, setCargando] = useState(true);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setSolicitudes(await listTherapistRequests());
    setCargando(false);
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function resolver(id: string, accion: "aceptar" | "rechazar") {
    setTrabajando(id);
    setError(null);
    try {
      await (accion === "aceptar" ? acceptContactRequest(id) : rejectContactRequest(id));
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar la solicitud.");
    } finally {
      setTrabajando(null);
    }
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center rounded-3xl border border-white/40 p-10">
        <Loader2 className="animate-spin text-primary" size={22} />
      </div>
    );
  }

  if (solicitudes.length === 0) {
    return (
      <p className="rounded-3xl glass-card border border-white/40 p-6 text-sm text-muted-foreground">
        Todavía no has recibido solicitudes de contacto.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {solicitudes.map((s) => (
        <article key={s.id} className="rounded-3xl glass-card border border-white/40 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-bold text-primary">{s.patientName || "Paciente"}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(s.createdAt).toLocaleDateString("es-CO", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-bold ${CLASE_ESTADO[s.status]}`}
            >
              {CONTACT_STATUS_LABELS[s.status]}
            </span>
          </div>

          {s.message && (
            <p className="mt-3 rounded-2xl bg-white/60 p-3 text-sm leading-relaxed text-slate-700">
              {s.message}
            </p>
          )}

          {s.status === "pending" && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={trabajando === s.id}
                onClick={() => resolver(s.id, "aceptar")}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                Aceptar
              </button>
              <button
                type="button"
                disabled={trabajando === s.id}
                onClick={() => resolver(s.id, "rechazar")}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 disabled:opacity-60"
              >
                Rechazar
              </button>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
