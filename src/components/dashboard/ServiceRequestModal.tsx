// ============================================================================
// Solicitud de servicios adicionales.
//
// La solicitud se guarda en service_requests y el equipo clínico contacta al
// paciente. No hay cobro todavía: la pasarela se conecta en una fase posterior,
// y por eso el texto habla de contacto y no de pago inmediato.
// ============================================================================
import { useState } from "react";
import { CheckCircle, Loader2, Stethoscope, X } from "lucide-react";
import { createServiceRequest, SERVICE_OPTIONS, type ServiceType } from "../../lib/api";

interface Props {
  patientId: string;
  onClose: () => void;
}

export function ServiceRequestModal({ patientId, onClose }: Props) {
  const [selected, setSelected] = useState<ServiceType | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;

    setSaving(true);
    setErrorMsg(null);
    try {
      await createServiceRequest({ patientId, serviceType: selected, notes });
      setSent(true);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "No pudimos registrar tu solicitud. Intenta de nuevo.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="service-title"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        {sent ? (
          <div className="p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle size={32} strokeWidth={1.5} />
            </div>
            <h2 className="mt-6 text-xl font-bold text-slate-900">Solicitud registrada</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Recibimos tu solicitud. Nuestro equipo se pondrá en contacto contigo para coordinar
              los detalles y el costo del servicio.
            </p>
            <button
              onClick={onClose}
              className="mt-6 w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90"
            >
              Entendido
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between border-b border-slate-100 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Stethoscope size={20} />
                </div>
                <div>
                  <h2 id="service-title" className="text-lg font-bold text-slate-900">
                    Solicitar servicio adicional
                  </h2>
                  <p className="text-xs text-slate-500">
                    Servicios por fuera de lo incluido en tu plan.
                  </p>
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
              {errorMsg && (
                <p
                  role="alert"
                  className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600"
                >
                  {errorMsg}
                </p>
              )}

              <fieldset>
                <legend className="text-sm font-semibold text-slate-900">
                  ¿Qué servicio necesitas?
                </legend>
                <div className="mt-3 space-y-2">
                  {SERVICE_OPTIONS.map((option) => (
                    <label
                      key={option.type}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all ${
                        selected === option.type
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-slate-200 hover:border-primary/30 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="service-type"
                        value={option.type}
                        checked={selected === option.type}
                        onChange={() => setSelected(option.type)}
                        className="mt-1 h-4 w-4 shrink-0 accent-primary"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-slate-800">
                          {option.title}
                        </span>
                        <span className="block text-xs leading-relaxed text-slate-500">
                          {option.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="mt-5">
                <label htmlFor="service-notes" className="text-sm font-semibold text-slate-900">
                  Cuéntanos más <span className="font-normal text-slate-500">(opcional)</span>
                </label>
                <textarea
                  id="service-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ej. Preferiría una cita en la mañana, o cualquier detalle que debamos saber."
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm focus:border-primary focus:outline-none"
                />
              </div>

              <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">
                Al enviar tu solicitud, nuestro equipo te contactará para coordinar la fecha y el
                costo. No se realiza ningún cobro en este momento.
              </p>

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!selected || saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Enviando…
                    </>
                  ) : (
                    "Enviar solicitud"
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
