// ============================================================================
// Consentimiento informado clínico (Ley 1090/2006) — paso obligatorio.
//
// Va justo antes de la anamnesis: no se le pide a nadie su historia clínica sin
// haber consentido el proceso al que esa historia pertenece.
//
// Calca la estructura de /consentimiento (el de datos, Ley 1581) para que el
// paciente reconozca el patrón, pero con dos diferencias deliberadas:
//
//  - La aceptación exige marcar un checkbox. En el de datos el botón basta
//    porque es el paso de una autorización de contacto; aquí se consiente un
//    proceso de salud, y el acto tiene que ser inequívoco (Doctrina No. 3 de
//    Colpsic: consentimiento expreso, no tácito).
//  - No hay casilla opcional de marketing: nada opcional debe compartir espacio
//    con un consentimiento clínico.
// ============================================================================
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FileSignature, Loader2 } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { acceptClinicalConsent } from "../lib/api";
import {
  ClinicalConsentContent,
  CLINICAL_CONSENT_TITLE,
} from "../components/ClinicalConsentText";

export const Route = createFileRoute("/consentimiento-clinico")({
  head: () => ({
    meta: [{ title: "Consentimiento del proceso — Mente en Foco" }],
  }),
  component: ConsentimientoClinico,
});

function ConsentimientoClinico() {
  const { profile, session } = useAuth();
  const [aceptado, setAceptado] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleAccept() {
    const userId = profile?.id ?? session?.user?.id;
    if (!userId) {
      setErrorMsg("Sesión no disponible. Vuelve a iniciar sesión.");
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      await acceptClinicalConsent(userId);
      // Recarga completa: useAuth vuelve a resolver el gate y decide el siguiente
      // paso (la anamnesis) en vez de asumirlo desde aquí.
      window.location.href = "/ingresa";
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "No pudimos registrar tu consentimiento. Intenta de nuevo.",
      );
      setSaving(false);
    }
  }

  return (
    <section className="gradient-soft flex min-h-[85vh] w-full items-center justify-center px-4 py-10 md:px-6">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-xl">
        <div className="flex items-start gap-3 border-b border-slate-100 px-6 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileSignature size={18} />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">{CLINICAL_CONSENT_TITLE}</h1>
            <p className="text-xs text-slate-500">
              Antes de empezar tu proceso, lee esta información y confírmanos que estás de acuerdo.
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <ClinicalConsentContent />
        </div>

        <div className="border-t border-slate-100 px-6 py-4">
          {errorMsg && (
            <p
              role="alert"
              className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600"
            >
              {errorMsg}
            </p>
          )}

          <label className="mb-3 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:bg-slate-50">
            <input
              type="checkbox"
              checked={aceptado}
              onChange={(e) => setAceptado(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            />
            <span className="text-xs leading-relaxed text-slate-600">
              Leí y entendí esta información, y acepto de forma libre y voluntaria iniciar mi
              proceso de atención psicológica en Mente en Foco.
            </span>
          </label>

          <button
            onClick={() => void handleAccept()}
            disabled={!aceptado || saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Guardando…
              </>
            ) : (
              "Acepto y continúo"
            )}
          </button>

          <p className="mt-3 text-center text-xs text-slate-400">
            Puedes revocarlo cuando quieras desde los ajustes de tu cuenta.
          </p>
        </div>
      </div>
    </section>
  );
}
