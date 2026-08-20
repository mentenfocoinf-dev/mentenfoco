// ============================================================================
// Mis solicitudes — panel del paciente.
//
// Lo que has pedido y en qué quedó. Solo llegan las propias: lo filtra la
// función de la base.
//
// Cancelar es la única acción, y solo mientras esté pendiente. Una solicitud
// resuelta se queda a la vista: saber que un profesional no aceptó es parte de
// la información, y esconderlo dejaría a la persona sin entender por qué no
// pasa nada.
// ============================================================================
import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  cancelContactRequest,
  listPatientRequests,
  CONTACT_STATUS_LABELS,
  type PatientContactRequest,
} from "../../lib/api";

const CLASE_ESTADO: Record<string, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  accepted: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-slate-200 bg-slate-50 text-slate-600",
  cancelled: "border-slate-200 bg-slate-50 text-slate-500",
};

export function MisSolicitudes() {
  const [solicitudes, setSolicitudes] = useState<PatientContactRequest[]>([]);
  const [cargando, setCargando] = useState(true);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setSolicitudes(await listPatientRequests());
    setCargando(false);
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function cancelar(id: string) {
    setTrabajando(id);
    setError(null);
    try {
      await cancelContactRequest(id);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cancelar la solicitud.");
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
        Todavía no has solicitado contacto con ningún profesional.
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
              <p className="font-bold text-primary">{s.therapistName || "Profesional"}</p>
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

          {s.status === "pending" && (
            <button
              type="button"
              disabled={trabajando === s.id}
              onClick={() => cancelar(s.id)}
              className="mt-4 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 disabled:opacity-60"
            >
              Cancelar solicitud
            </button>
          )}
        </article>
      ))}
    </div>
  );
}
