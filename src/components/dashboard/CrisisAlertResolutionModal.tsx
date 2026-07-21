// ============================================================================
// Cierre trazable de una alerta de crisis.
//
// Reemplaza el antiguo "descartar" (que solo la ocultaba en el cliente): el
// terapeuta debe declarar qué acción tomó, y eso queda en la historia clínica.
// ============================================================================
import { useState } from "react";
import { Loader2, ShieldCheck, X } from "lucide-react";
import {
  resolveCrisisAlert,
  ALERT_RESOLUTION_LABELS,
  type AlertResolutionAction,
} from "../../lib/api";

interface Props {
  alertId: string;
  patientName: string;
  therapistId: string;
  onClose: () => void;
  onResolved: (alertId: string) => void;
}

const ACTIONS = Object.keys(ALERT_RESOLUTION_LABELS) as AlertResolutionAction[];

export function CrisisAlertResolutionModal({
  alertId,
  patientName,
  therapistId,
  onClose,
  onResolved,
}: Props) {
  const [action, setAction] = useState<AlertResolutionAction | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!action) return;

    setSaving(true);
    setErrorMsg(null);
    try {
      await resolveCrisisAlert({ alertId, therapistId, action, notes });
      onResolved(alertId);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "No se pudo registrar la atención de la alerta.",
      );
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="resolve-alert-title"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 id="resolve-alert-title" className="text-lg font-bold text-slate-900">
                Registrar atención de la alerta
              </h2>
              <p className="text-xs text-slate-500">{patientName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <p className="text-sm text-slate-600">
            Esta alerta quedará registrada en la historia clínica junto con la acción que indiques.
            No se elimina.
          </p>

          {errorMsg && (
            <p
              role="alert"
              className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600"
            >
              {errorMsg}
            </p>
          )}

          <fieldset className="mt-5">
            <legend className="text-sm font-semibold text-slate-900">¿Qué acción tomaste?</legend>
            <div className="mt-3 space-y-2">
              {ACTIONS.map((value) => (
                <label
                  key={value}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
                    action === value
                      ? "border-primary bg-primary/5"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="resolution-action"
                    value={value}
                    checked={action === value}
                    onChange={() => setAction(value)}
                    className="h-4 w-4 shrink-0 accent-primary"
                  />
                  <span className="text-sm text-slate-700">{ALERT_RESOLUTION_LABELS[value]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-5">
            <label htmlFor="resolution-notes" className="text-sm font-semibold text-slate-900">
              Observaciones <span className="font-normal text-slate-500">(opcional)</span>
            </label>
            <textarea
              id="resolution-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ej. Se contactó por teléfono, refiere estar acompañada. Se adelanta la sesión al martes."
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!action || saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Guardando…
                </>
              ) : (
                "Registrar atención"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
