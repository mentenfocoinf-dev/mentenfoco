import { createFileRoute, useRouter } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { Users, Loader2, CheckCircle } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { signIn, signOut, requestPasswordReset } from "../lib/api";

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

function Ingresa() {
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();

  const [view, setView] = useState<View>("login");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [forgotEmail, setForgotEmail] = useState("");

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
      <section className="mx-auto flex min-h-[80vh] w-full items-center justify-center px-4 py-16 md:px-6">
        <div className="card-neon-hover w-full max-w-md rounded-3xl glass bg-white/40 p-10 shadow-xl transition-all">

          {/* ── Login ── */}
          {view === "login" && (
            <>
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 shadow-inner text-primary border border-primary/20">
                  <Users size={32} strokeWidth={1.5} />
                </div>
                <h1 className="mt-6 text-3xl font-bold text-primary drop-shadow-sm">
                  Portal de Usuarios
                </h1>
                <p className="mt-3 text-sm text-muted-foreground">
                  Accede a tu cuenta para gestionar tus sesiones y recursos clínicos.
                </p>
              </div>

              {errorMsg && (
                <p role="alert" className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-center text-red-600">
                  {errorMsg}
                </p>
              )}

              <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
                <div>
                  <label htmlFor="login-email" className="text-sm font-semibold text-primary">
                    Correo electrónico
                  </label>
                  <input
                    id="login-email"
                    name="user"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="ej. usuario@correo.com"
                    className="mt-1 w-full rounded-xl border border-white/50 bg-white/50 backdrop-blur px-3 py-3 text-sm focus:border-primary focus:outline-none shadow-sm"
                  />
                </div>
                <div>
                  <label htmlFor="login-pass" className="text-sm font-semibold text-primary">
                    Contraseña
                  </label>
                  <input
                    id="login-pass"
                    name="pass"
                    type="password"
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="mt-1 w-full rounded-xl border border-white/50 bg-white/50 backdrop-blur px-3 py-3 text-sm focus:border-primary focus:outline-none shadow-sm"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => { setView("forgot"); setErrorMsg(null); }}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-4 w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-transform hover:scale-[1.02] shadow-lg shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><Loader2 size={16} className="animate-spin" /> Procesando…</>
                  ) : (
                    "Iniciar Sesión"
                  )}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                El acceso es exclusivo para usuarios con membresía o pacientes activos.
              </p>
            </>
          )}

          {/* ── Recuperar contraseña ── */}
          {view === "forgot" && (
            <>
              <div className="text-center">
                <h1 className="text-2xl font-bold text-primary">Recuperar contraseña</h1>
                <p className="mt-3 text-sm text-muted-foreground">
                  Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
                </p>
              </div>

              {errorMsg && (
                <p role="alert" className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-center text-red-600">
                  {errorMsg}
                </p>
              )}

              <form className="mt-6 space-y-4" onSubmit={handleForgotPassword} noValidate>
                <div>
                  <label htmlFor="forgot-email" className="text-sm font-semibold text-primary">
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
                    className="mt-1 w-full rounded-xl border border-white/50 bg-white/50 backdrop-blur px-3 py-3 text-sm focus:border-primary focus:outline-none shadow-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !forgotEmail}
                  className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-transform hover:scale-[1.02] shadow-lg shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                className="mt-4 w-full text-sm text-muted-foreground hover:text-primary text-center hover:underline"
              >
                ← Volver al inicio de sesión
              </button>
            </>
          )}

          {/* ── Confirmación envío ── */}
          {view === "forgot-sent" && (
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle size={32} />
              </div>
              <h2 className="mt-6 text-xl font-bold text-slate-900">Revisa tu correo</h2>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                Si existe una cuenta asociada a <strong>{forgotEmail}</strong>, recibirás un enlace
                para restablecer tu contraseña en los próximos minutos.
              </p>
              <button
                onClick={() => { setView("login"); setErrorMsg(null); setForgotEmail(""); }}
                className="mt-6 w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Volver al inicio de sesión
              </button>
            </div>
          )}
        </div>
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
