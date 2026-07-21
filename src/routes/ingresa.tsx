import { createFileRoute, useRouter } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { Loader2, CheckCircle, ChevronLeft, ShieldCheck, Sparkle } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { signIn, signOut, requestPasswordReset } from "../lib/api";
import { SignupModal } from "../components/SignupModal";
import { SocialAuthButtons } from "../components/SocialAuthButtons";

// Lazy loading de dashboards — solo se carga el que corresponde al rol del usuario
const PatientDashboard = lazy(() =>
  import("../components/dashboard/PatientDashboard").then((m) => ({ default: m.PatientDashboard }))
);
const TherapistDashboard = lazy(() =>
  import("../components/dashboard/TherapistDashboard").then((m) => ({ default: m.TherapistDashboard }))
);
const AdminDashboard = lazy(() =>
  import("../components/dashboard/AdminDashboard").then((m) => ({ default: m.AdminDashboard }))
);

const DashboardFallback = () => (
  <div className="flex min-h-[80vh] items-center justify-center">
    <Loader2 className="animate-spin text-primary" size={32} />
  </div>
);

export const Route = createFileRoute("/ingresa")({
  head: () => ({
    meta: [
      { title: "Portal de Usuarios — Mente en Foco" },
      {
        name: "description",
        content: "Accede a tu cuenta para gestionar tus sesiones, recursos y progreso personal.",
      },
      { property: "og:title", content: "Portal de Usuarios — Mente en Foco" },
      {
        property: "og:description",
        content: "Accede a tu cuenta para gestionar tus sesiones, recursos y progreso personal.",
      },
    ],
  }),
  component: Ingresa,
});

type View = "login" | "forgot" | "forgot-sent";

const inputClass =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none transition-colors";

/**
 * Panel decorativo izquierdo. Solo se muestra desde lg: en pantallas pequeñas el
 * formulario ocupa todo el ancho, que es lo que se espera en móvil.
 */
function BrandPanel() {
  return (
    <div className="relative hidden overflow-hidden rounded-2xl bg-primary lg:flex lg:w-[45%] lg:flex-col lg:justify-between">
      {/* Halos de color: reemplazan la imagen de fondo del diseño de referencia
          manteniendo la paleta de la marca en vez de introducir un morado ajeno. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-sky-400/30 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-cyan-300/20 blur-3xl"
      />

      <div className="relative p-8">
        <img src="/Logo.png" alt="Mente en Foco" className="h-10 w-auto brightness-0 invert" />
      </div>

      <div className="relative p-8">
        <p className="text-sm font-medium text-white/70">Tu espacio de acompañamiento</p>
        <h2 className="mt-2 text-3xl font-bold leading-tight text-white">
          Un lugar seguro para cuidar tu salud mental
        </h2>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/70">
          Gestiona tus sesiones, sigue tu progreso y accede a recursos clínicos acompañado por
          profesionales.
        </p>

        <div className="mt-8 flex items-center gap-6 text-xs text-white/60">
          <span className="flex items-center gap-2">
            <ShieldCheck size={14} />
            Datos protegidos
          </span>
          <span className="flex items-center gap-2">
            <Sparkle size={14} />
            Atención profesional
          </span>
        </div>
      </div>
    </div>
  );
}

function Ingresa() {
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();

  const [view, setView] = useState<View>("login");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [forgotEmail, setForgotEmail] = useState("");
  const [signupOpen, setSignupOpen] = useState(false);

  // ── Login ─────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const fd = new FormData(e.currentTarget);
      const email = fd.get("user") as string;
      const pass = fd.get("pass") as string;

      await signIn(email, pass);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Ocurrió un error inesperado. Intenta de nuevo.",
      );
    } finally {
      setLoading(false);
    }
  }

  // ── Forgot password ───────────────────────────────────────────────────
  async function handleForgotPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      await requestPasswordReset(forgotEmail);
      setView("forgot-sent");
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Ocurrió un error inesperado. Intenta de nuevo.",
      );
    } finally {
      setLoading(false);
    }
  }

  // ── Logout ────────────────────────────────────────────────────────────
  async function handleLogout() {
    await signOut();
    router.invalidate();
  }

  // ── Vista: Cargando ───────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  // ── Vista: Formulario de Login / Forgot Password ──────────────────────
  if (!profile) {
    return (
      <section className="gradient-soft flex min-h-[85vh] w-full items-center justify-center px-4 py-10 md:px-6">
        <div className="glass-card flex w-full max-w-4xl gap-0 rounded-3xl p-3 shadow-xl lg:gap-3">
          <BrandPanel />

          <div className="flex w-full flex-col justify-center px-6 py-8 sm:px-10 lg:w-[55%]">
            {/* ── Login ── */}
            {view === "login" && (
              <>
                <img src="/Logo.png" alt="Mente en Foco" className="h-9 w-auto" />
                <h1 className="mt-6 text-2xl font-bold text-slate-900">Portal de Usuarios</h1>
                <p className="mt-2 text-sm text-slate-500">
                  Accede a tu cuenta para gestionar tus sesiones y recursos clínicos.
                </p>

                {errorMsg && (
                  <p
                    role="alert"
                    className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600"
                  >
                    {errorMsg}
                  </p>
                )}

                <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
                  <div>
                    <label htmlFor="login-email" className="text-sm font-semibold text-slate-900">
                      Correo electrónico
                    </label>
                    <input
                      id="login-email"
                      name="user"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="ej. usuario@correo.com"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="login-pass" className="text-sm font-semibold text-slate-900">
                      Contraseña
                    </label>
                    <input
                      id="login-pass"
                      name="pass"
                      type="password"
                      required
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className={inputClass}
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => { setView("forgot"); setErrorMsg(null); }}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:scale-[1.01] hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? (
                      <><Loader2 size={16} className="animate-spin" /> Procesando…</>
                    ) : (
                      "Iniciar Sesión"
                    )}
                  </button>
                </form>

                <SocialAuthButtons onError={(m) => setErrorMsg(m || null)} disabled={loading} />

                <p className="mt-6 text-center text-sm text-slate-500">
                  ¿Aún no tienes cuenta?{" "}
                  <button
                    type="button"
                    onClick={() => setSignupOpen(true)}
                    className="font-semibold text-primary hover:underline"
                  >
                    Crear cuenta gratis
                  </button>
                </p>
              </>
            )}

            {/* ── Recuperar contraseña ── */}
            {view === "forgot" && (
              <>
                <img src="/Logo.png" alt="Mente en Foco" className="h-9 w-auto" />
                <h1 className="mt-6 text-2xl font-bold text-slate-900">Recuperar contraseña</h1>
                <p className="mt-2 text-sm text-slate-500">
                  Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
                </p>

                {errorMsg && (
                  <p
                    role="alert"
                    className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600"
                  >
                    {errorMsg}
                  </p>
                )}

                <form className="mt-6 space-y-4" onSubmit={handleForgotPassword} noValidate>
                  <div>
                    <label htmlFor="forgot-email" className="text-sm font-semibold text-slate-900">
                      Correo electrónico
                    </label>
                    <input
                      id="forgot-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="ej. usuario@correo.com"
                      className={inputClass}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !forgotEmail}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:scale-[1.01] hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? (
                      <><Loader2 size={16} className="animate-spin" /> Enviando…</>
                    ) : (
                      "Enviar enlace de recuperación"
                    )}
                  </button>
                </form>

                <button
                  onClick={() => { setView("login"); setErrorMsg(null); setForgotEmail(""); }}
                  className="mt-4 flex w-full items-center justify-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-primary"
                >
                  <ChevronLeft size={14} />
                  Volver al inicio de sesión
                </button>
              </>
            )}

            {/* ── Confirmación envío ── */}
            {view === "forgot-sent" && (
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <CheckCircle size={32} strokeWidth={1.5} />
                </div>
                <h2 className="mt-6 text-xl font-bold text-slate-900">Revisa tu correo</h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-500">
                  Si existe una cuenta asociada a <strong>{forgotEmail}</strong>, recibirás un
                  enlace para restablecer tu contraseña en los próximos minutos.
                </p>
                <button
                  onClick={() => { setView("login"); setErrorMsg(null); setForgotEmail(""); }}
                  className="mt-6 w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90"
                >
                  Volver al inicio de sesión
                </button>
              </div>
            )}
          </div>
        </div>

        <SignupModal open={signupOpen} onClose={() => setSignupOpen(false)} />
      </section>
    );
  }

  // ── Vista: Enrutador dinámico de dashboard (con lazy loading) ─────────
  return (
    <Suspense fallback={<DashboardFallback />}>
      {profile.role === "admin" && <AdminDashboard profile={profile} onLogout={handleLogout} />}
      {profile.role === "therapist" && <TherapistDashboard profile={profile} onLogout={handleLogout} />}
      {(profile.role === "patient" || !profile.role) && <PatientDashboard profile={profile} onLogout={handleLogout} />}
    </Suspense>
  );
}
