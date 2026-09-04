// ============================================================================
// Modal de creación de cuenta gratuita (captura de leads).
//
// La cuenta resultante no da acceso al producto: sin terapeuta, sin sesiones,
// sin mensajería. Solo la vitrina de guías de cortesía. El objetivo es capturar
// contacto + consentimiento de marketing.
//
// Sigue el patrón de modal del sitio (PsychometricScaleModal / ClinicalReportModal):
// tarjeta blanca sólida sobre overlay oscuro, cabecera fija con borde y cuerpo
// desplazable. El estilo `glass` es para tarjetas sobre el fondo de página, no
// sobre un overlay — ahí se ve apagado.
// ============================================================================
import { useEffect, useRef, useState } from "react";
import { CheckCircle, Loader2, UserPlus, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { trackEvent } from "../lib/api";
import { track } from "../lib/analytics";
import { PrivacyPolicyModal } from "./PrivacyPolicyModal";

interface SignupModalProps {
  open: boolean;
  onClose: () => void;
}

const inputClass =
  "mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none transition-colors";

// ============================================================================
// R3 · Cloudflare Turnstile (captcha anti-bot en el signup público).
//
// El site key es PÚBLICO y viaja al frontend por env: VITE_TURNSTILE_SITE_KEY.
// El secret vive solo en el Edge Function (TURNSTILE_SECRET_KEY). Mientras el
// site key no esté configurado, el widget NO se renderiza y el formulario
// funciona igual (el backend, sin su secret, también omite la verificación).
// En cuanto se cargan ambas claves, el captcha se exige de punta a punta.
// ============================================================================
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        },
      ) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

function ensureTurnstileScript(): void {
  if (document.querySelector(`script[src="${TURNSTILE_SCRIPT}"]`)) return;
  const s = document.createElement("script");
  s.src = TURNSTILE_SCRIPT;
  s.async = true;
  s.defer = true;
  document.head.appendChild(s);
}

// Renderiza el widget y entrega el token por onToken (null al expirar o fallar).
// Remontarlo (cambiando su prop key) fuerza un desafío nuevo tras un intento
// fallido, porque los tokens de Turnstile son de un solo uso.
function TurnstileWidget({ onToken }: { onToken: (t: string | null) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    ensureTurnstileScript();
    let cancelled = false;
    const tryRender = () => {
      if (cancelled) return;
      if (window.turnstile && ref.current && widgetId.current === null) {
        widgetId.current = window.turnstile.render(ref.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token: string) => onToken(token),
          "expired-callback": () => onToken(null),
          "error-callback": () => onToken(null),
        });
      } else if (!window.turnstile) {
        setTimeout(tryRender, 200);
      }
    };
    tryRender();
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  }, [onToken]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={ref} className="mt-5 flex justify-center" />;
}

export function SignupModal({ open, onClose }: SignupModalProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  // R3 · token de Turnstile; captchaNonce remonta el widget para un desafío
  // nuevo tras un intento fallido (los tokens son de un solo uso).
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaNonce, setCaptchaNonce] = useState(0);

  if (!open) return null;

  const captchaRequired = Boolean(TURNSTILE_SITE_KEY);

  function handleClose() {
    setFullName("");
    setEmail("");
    setPhone("");
    setTermsAccepted(false);
    setMarketingConsent(false);
    setErrorMsg(null);
    setSuccess(false);
    setCaptchaToken(null);
    setCaptchaNonce((n) => n + 1);
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
          captcha_token: captchaToken,
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
        // Token de un solo uso: tras un fallo, pide un desafío nuevo.
        setCaptchaToken(null);
        setCaptchaNonce((n) => n + 1);
        return;
      }
      if (data?.error) {
        setErrorMsg(data.error);
        setCaptchaToken(null);
        setCaptchaNonce((n) => n + 1);
        return;
      }

      trackEvent("ACCOUNT_CREATED");
      track("registro_completado");
      setSuccess(true);
    } catch {
      setErrorMsg("Ocurrió un error inesperado. Intenta de nuevo.");
      setCaptchaToken(null);
      setCaptchaNonce((n) => n + 1);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signup-title"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        {success ? (
          <div className="p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle size={32} strokeWidth={1.5} />
            </div>
            <h2 className="mt-6 text-xl font-bold text-slate-900">Revisa tu correo</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Te enviamos tus credenciales de acceso a <strong>{email}</strong>. Al ingresar por
              primera vez te pediremos que cambies la contraseña temporal por una propia.
            </p>
            <button
              onClick={handleClose}
              className="mt-6 w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90"
            >
              Entendido
            </button>
          </div>
        ) : (
          <>
            {/* Cabecera fija */}
            <div className="flex items-start justify-between border-b border-slate-100 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <UserPlus size={20} />
                </div>
                <div>
                  <h2 id="signup-title" className="text-lg font-bold text-slate-900">
                    Crea tu cuenta gratis
                  </h2>
                  <p className="text-xs text-slate-500">
                    Acceso sin costo a una selección de guías de bienestar.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Cerrar"
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {/* Cuerpo desplazable */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6" noValidate>
              <p className="text-sm text-slate-600">
                Te enviamos tus credenciales por correo. No necesitas tarjeta ni compromiso alguno.
              </p>

              {errorMsg && (
                <p
                  role="alert"
                  className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600"
                >
                  {errorMsg}
                </p>
              )}

              <div className="mt-5 space-y-4">
                <div>
                  <label htmlFor="signup-name" className="text-sm font-semibold text-slate-900">
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
                  <label htmlFor="signup-email" className="text-sm font-semibold text-slate-900">
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
                  <label htmlFor="signup-phone" className="text-sm font-semibold text-slate-900">
                    Teléfono <span className="font-normal text-slate-500">(opcional)</span>
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
              </div>

              <div className="mt-5 space-y-2">
                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                    termsAccepted ? "border-primary bg-primary/5" : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    required
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                  />
                  <span className="text-xs leading-relaxed text-slate-600">
                    Acepto la{" "}
                    {/* El enlace vive fuera del flujo del label: un click aquí no debe
                        marcar la casilla, solo abrir la política. */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setPolicyOpen(true);
                      }}
                      className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
                    >
                      política de tratamiento de datos personales
                    </button>
                    .
                  </span>
                </label>

                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                    marketingConsent
                      ? "border-primary bg-primary/5"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={marketingConsent}
                    onChange={(e) => setMarketingConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                  />
                  <span className="text-xs leading-relaxed text-slate-600">
                    Quiero recibir información comercial, novedades y contenido de bienestar de
                    Mente en Foco por correo electrónico.
                  </span>
                </label>
              </div>

              {/* R3 · captcha. Solo aparece si VITE_TURNSTILE_SITE_KEY está
                  configurado; si no, no se renderiza y el submit no lo exige. */}
              <TurnstileWidget key={captchaNonce} onToken={setCaptchaToken} />

              <button
                type="submit"
                disabled={
                  loading ||
                  !termsAccepted ||
                  !fullName ||
                  !email ||
                  (captchaRequired && !captchaToken)
                }
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
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

      <PrivacyPolicyModal open={policyOpen} onClose={() => setPolicyOpen(false)} />
    </div>
  );
}
