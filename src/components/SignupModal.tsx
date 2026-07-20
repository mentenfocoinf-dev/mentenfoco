// ============================================================================
// Modal de creación de cuenta gratuita (captura de leads).
//
// La cuenta resultante no da acceso al producto: sin terapeuta, sin sesiones,
// sin mensajería. Solo la vitrina de guías de cortesía. El objetivo es capturar
// contacto + consentimiento de marketing.
// ============================================================================
import { useState } from "react";
import { CheckCircle, Loader2, Sparkles, X } from "lucide-react";
import { supabase } from "../lib/supabase";

interface SignupModalProps {
  open: boolean;
  onClose: () => void;
}

// Texto del aviso de privacidad. Cubre los 3 elementos mínimos de la Ley 1581 de
// 2012: identidad/contacto del responsable, finalidad del tratamiento y mecanismo
// para ejercer los derechos del titular.
const TERMS_TEXT =
  "Autorizo a Mente en Foco (contacto: mentenfocoinf@gmail.com) a tratar mis datos personales " +
  "(nombre, correo electrónico y teléfono) con la finalidad de crear mi cuenta gratuita en la " +
  "plataforma, darme acceso a contenido de bienestar de cortesía, y — si marco la casilla de " +
  "comunicaciones — enviarme información comercial y de marketing sobre nuestros servicios. Podré " +
  "conocer, actualizar, rectificar o solicitar la eliminación de mis datos en cualquier momento " +
  "escribiendo al correo anterior, de acuerdo con la Ley 1581 de 2012 y sus decretos reglamentarios.";

const inputClass =
  "mt-1 w-full rounded-xl border border-white/50 bg-white/50 backdrop-blur px-3 py-3 text-sm focus:border-primary focus:outline-none shadow-sm";

export function SignupModal({ open, onClose }: SignupModalProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!open) return null;

  function handleClose() {
    setFullName("");
    setEmail("");
    setPhone("");
    setTermsAccepted(false);
    setMarketingConsent(false);
    setErrorMsg(null);
    setSuccess(false);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase.functions.invoke("public-signup", {
        body: {
          email,
          full_name: fullName,
          phone: phone || null,
          terms_accepted: true,
          marketing_consent: marketingConsent,
        },
      });

      // functions.invoke marca error para cualquier status >= 400, pero el mensaje
      // útil viaja en el cuerpo de la respuesta — hay que leerlo del contexto.
      if (error) {
        let message = "No pudimos crear tu cuenta. Intenta de nuevo.";
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.json === "function") {
          try {
            const body = await ctx.json();
            if (body?.error) message = body.error;
          } catch {
            /* respuesta sin JSON: se queda el mensaje genérico */
          }
        }
        setErrorMsg(message);
        return;
      }
      if (data?.error) {
        setErrorMsg(data.error);
        return;
      }

      setSuccess(true);
    } catch {
      setErrorMsg("Ocurrió un error inesperado. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signup-title"
    >
      <div className="card-neon-hover relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl glass bg-white/60 p-8 shadow-xl">
        <button
          type="button"
          onClick={handleClose}
          aria-label="Cerrar"
          className="absolute right-5 top-5 text-muted-foreground transition-colors hover:text-primary"
        >
          <X size={20} />
        </button>

        {success ? (
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle size={32} />
            </div>
            <h2 className="mt-6 text-xl font-bold text-slate-900">Revisa tu correo</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Te enviamos tus credenciales de acceso a <strong>{email}</strong>. Al ingresar por
              primera vez te pediremos que cambies la contraseña temporal por una propia.
            </p>
            <button
              onClick={handleClose}
              className="mt-6 w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Entendido
            </button>
          </div>
        ) : (
          <>
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-inner">
                <Sparkles size={32} strokeWidth={1.5} />
              </div>
              <h2 id="signup-title" className="mt-6 text-2xl font-bold text-primary drop-shadow-sm">
                Crea tu cuenta gratis
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Accede sin costo a una selección de guías de bienestar. Te enviamos tus credenciales
                por correo.
              </p>
            </div>

            {errorMsg && (
              <p
                role="alert"
                className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-center text-sm text-red-600"
              >
                {errorMsg}
              </p>
            )}

            <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
              <div>
                <label htmlFor="signup-name" className="text-sm font-semibold text-primary">
                  Nombre completo
                </label>
                <input
                  id="signup-name"
                  type="text"
                  required
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="ej. María Gómez"
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="signup-email" className="text-sm font-semibold text-primary">
                  Correo electrónico
                </label>
                <input
                  id="signup-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ej. usuario@correo.com"
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="signup-phone" className="text-sm font-semibold text-primary">
                  Teléfono <span className="font-normal text-muted-foreground">(opcional)</span>
                </label>
                <input
                  id="signup-phone"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="ej. 300 123 4567"
                  className={inputClass}
                />
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/50 bg-white/40 p-3">
                <input
                  type="checkbox"
                  required
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 accent-primary"
                />
                <span className="text-xs leading-relaxed text-muted-foreground">{TERMS_TEXT}</span>
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/50 bg-white/40 p-3">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(e) => setMarketingConsent(e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 accent-primary"
                />
                <span className="text-xs leading-relaxed text-muted-foreground">
                  Quiero recibir información comercial, novedades y contenido de bienestar de Mente
                  en Foco por correo electrónico.
                </span>
              </label>

              <button
                type="submit"
                disabled={loading || !termsAccepted || !fullName || !email}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:scale-[1.02] hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Creando cuenta…
                  </>
                ) : (
                  "Crear cuenta gratis"
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
