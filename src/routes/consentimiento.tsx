// ============================================================================
// Aceptación del tratamiento de datos.
//
// Paso obligatorio para quien entró por un proveedor externo (Google): ese flujo
// no pasa por el formulario de registro, así que nunca otorgó la autorización.
// Sin este paso tendríamos usuarios navegando con datos tratados y sin
// consentimiento registrado, que es precisamente lo que la política promete.
//
// El texto es el mismo del modal del registro (PrivacyPolicyContent), no una
// copia: si el documento cambia, cambia en los dos sitios a la vez.
// ============================================================================
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { PrivacyPolicyContent, PRIVACY_POLICY_VERSION } from "../components/PrivacyPolicyModal";

export const Route = createFileRoute("/consentimiento")({
  head: () => ({
    meta: [{ title: "Tratamiento de datos — Mente en Foco" }],
  }),
  component: Consentimiento,
});

function Consentimiento() {
  const { session } = useAuth();
  const [marketing, setMarketing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleAccept() {
    const userId = session?.user?.id;
    if (!userId) {
      setErrorMsg("Sesión no disponible. Vuelve a iniciar sesión.");
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          terms_accepted_at: new Date().toISOString(),
          terms_version: PRIVACY_POLICY_VERSION,
          marketing_consent: marketing,
        })
        .eq("id", userId);
      if (error) throw new Error(error.message);

      // Recarga completa: useAuth vuelve a leer el perfil y decide el siguiente
      // paso pendiente (datos mínimos o anamnesis) en vez de asumirlo aquí.
      window.location.href = "/ingresa";
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "No pudimos guardar tu autorización. Intenta de nuevo.",
      );
      setSaving(false);
    }
  }

  return (
    <section className="gradient-soft flex min-h-[85vh] w-full items-center justify-center px-4 py-10 md:px-6">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-xl">
        <div className="flex items-start gap-3 border-b border-slate-100 px-6 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">
              Antes de continuar, autoriza el tratamiento de tus datos
            </h1>
            <p className="text-xs text-slate-500">
              Es un paso único. Lee el documento y confirma para acceder a tu espacio.
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <PrivacyPolicyContent />
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
              checked={marketing}
              onChange={(e) => setMarketing(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            />
            <span className="text-xs leading-relaxed text-slate-500">
              Además, quiero recibir información comercial, novedades y contenido de bienestar por
              correo electrónico. <span className="text-slate-400">(Opcional)</span>
            </span>
          </label>

          <button
            onClick={handleAccept}
            disabled={saving}
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
        </div>
      </div>
    </section>
  );
}
