// ============================================================================
// Consentimiento del proceso, en los Ajustes del paciente.
//
// La Ley 1090 y la Doctrina No. 3 de Colpsic hacen del consentimiento un acto
// revocable: si el paciente no puede retirarlo con la misma facilidad con que lo
// dio, no era libre. Por eso vive aquí y no enterrado en un correo a soporte.
//
// Revocar NO borra la fila —eso destruiría la evidencia de que el proceso tuvo
// consentimiento— sino que sella `revoked_at`, y el terapeuta lo ve como alerta
// en la ficha. Se pide confirmación porque la consecuencia real es que el
// proceso clínico no debería continuar.
// ============================================================================
import { useEffect, useState } from "react";
import { AlertTriangle, FileSignature, Loader2, ShieldCheck } from "lucide-react";
import {
  formatConsentDate,
  getClinicalConsentState,
  revokeClinicalConsent,
  type ClinicalConsentState,
} from "../../lib/api";
import type { Profile } from "../../lib/supabase";

export function ClinicalConsentCard({ profile }: { profile: Profile }) {
  const [estado, setEstado] = useState<ClinicalConsentState | null>(null);
  const [cargando, setCargando] = useState(true);
  const [confirmando, setConfirmando] = useState(false);
  const [revocando, setRevocando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    getClinicalConsentState(profile)
      .then((e) => vigente && setEstado(e))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [profile]);

  async function revocar() {
    setRevocando(true);
    setErrorMsg(null);
    try {
      await revokeClinicalConsent(profile.id);
      setEstado(await getClinicalConsentState(profile));
      setConfirmando(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "No pudimos revocar el consentimiento.");
    } finally {
      setRevocando(false);
    }
  }

  if (cargando) {
    return (
      <div className="flex justify-center rounded-3xl glass-card border border-white/40 p-6">
        <Loader2 className="animate-spin text-primary" size={20} />
      </div>
    );
  }

  // Sin proceso clínico abierto no hay nada que consentir ni que revocar: una
  // cuenta que solo lee contenido no debería ver esta tarjeta.
  if (!estado || estado.estado === "no_aplica") return null;

  return (
    <div className="rounded-3xl glass-card border border-white/40 p-6">
      <div className="flex items-center gap-2">
        <FileSignature size={18} className="text-primary" />
        <h2 className="text-lg font-bold text-primary">Consentimiento del proceso</h2>
      </div>

      {estado.estado === "aceptado" && (
        <>
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <ShieldCheck size={12} /> Aceptado el {formatConsentDate(estado.consent.accepted_at)} ·
            versión {estado.consent.version}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Diste tu consentimiento para iniciar tu proceso de atención psicológica. Puedes
            retirarlo cuando quieras; tu profesional será notificado y podrán hablar de cómo
            continuar.
          </p>

          {errorMsg && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {errorMsg}
            </p>
          )}

          {!confirmando ? (
            <button
              onClick={() => setConfirmando(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-700 transition-colors hover:bg-red-50"
            >
              Revocar consentimiento del proceso
            </button>
          ) : (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="flex items-center gap-1.5 text-sm font-bold text-red-800">
                <AlertTriangle size={15} /> ¿Seguro que quieres revocarlo?
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-red-700">
                Tu proceso de atención no debería continuar sin un consentimiento vigente. El
                registro de que lo aceptaste se conserva, como exige la normativa de historia
                clínica. Puedes volver a aceptarlo más adelante.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={() => void revocar()}
                  disabled={revocando}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
                >
                  {revocando && <Loader2 size={14} className="animate-spin" />}
                  Sí, revocar
                </button>
                <button
                  onClick={() => setConfirmando(false)}
                  className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {estado.estado === "revocado" && (
        <>
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
            <AlertTriangle size={12} /> Revocado el{" "}
            {formatConsentDate(estado.consent.revoked_at as string)}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Retiraste tu consentimiento. Para retomar tu proceso de atención, se te pedirá aceptarlo
            de nuevo la próxima vez que entres a tu portal.
          </p>
        </>
      )}

      {estado.estado === "pendiente" && (
        <>
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            Pendiente
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Todavía no has aceptado el consentimiento de tu proceso. Te lo pediremos al entrar a tu
            portal.
          </p>
        </>
      )}
    </div>
  );
}
