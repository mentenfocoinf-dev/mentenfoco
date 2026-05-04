import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Users, Loader2 } from "lucide-react";
import { supabase, type Profile } from "../lib/supabase";
import { PatientDashboard } from "../components/dashboard/PatientDashboard";
import { TherapistDashboard } from "../components/dashboard/TherapistDashboard";
import { AdminDashboard } from "../components/dashboard/AdminDashboard";

export const Route = createFileRoute("/ingresa")({
  head: () => ({
    meta: [
      { title: "Portal de Usuarios — Mente en Foco" },
      { name: "description", content: "Accede a tu cuenta para gestionar tus sesiones, recursos y progreso personal." },
      { property: "og:title", content: "Portal de Usuarios — Mente en Foco" },
      { property: "og:description", content: "Accede a tu cuenta para gestionar tus sesiones, recursos y progreso personal." },
    ],
  }),
  component: Ingresa,
});

function Ingresa() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // Restaurar sesión activa
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email);
      }
    });

    // Escuchar cambios de estado (expiración, logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (event === "TOKEN_REFRESHED" && !session)) {
        setProfile(null);
        router.navigate({ to: "/ingresa" });
      } else if (event === "SIGNED_IN" && session) {
        fetchProfile(session.user.id, session.user.email);
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  async function fetchProfile(userId: string, email?: string) {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    
    setProfile(profileData ?? { 
      id: userId, 
      role: "patient", 
      plan_type: "free", 
      subscription_status: "canceled", 
      stripe_customer_id: null, 
      full_name: email ?? null, 
      avatar_url: null, 
      created_at: "", 
      updated_at: "" 
    });
  }

  // ── Login con Supabase Auth ───────────────────────────────────────────
  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const fd    = new FormData(e.currentTarget);
    const email = fd.get("user") as string;
    const pass  = fd.get("pass") as string;

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });

    if (authError || !authData.user) {
      setLoading(false);
      setErrorMsg("Credenciales incorrectas. Verifica tu correo y contraseña.");
      return;
    }

    // Cargar perfil del usuario
    await fetchProfile(authData.user.id, authData.user.email);
    setLoading(false);
  }

  // ── Logout ────────────────────────────────────────────────────────────
  async function handleLogout() {
    await supabase.auth.signOut();
    setProfile(null);
    router.invalidate();
  }

  // ── Vista: formulario de login ────────────────────────────────────────
  if (!profile) {
    return (
      <section className="mx-auto flex min-h-[80vh] w-full items-center justify-center px-4 py-16 md:px-6">
        <div className="card-neon-hover w-full max-w-md rounded-3xl glass bg-white/40 p-10 shadow-xl transition-all">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 shadow-inner text-primary border border-primary/20">
              <Users size={32} strokeWidth={1.5} />
            </div>
            <h1 className="mt-6 text-3xl font-bold text-primary drop-shadow-sm">Portal de Usuarios</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Accede a tu cuenta para gestionar tus sesiones, recursos y progreso personal.
            </p>
          </div>

          {errorMsg && (
            <p className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-center text-red-600">
              {errorMsg}
            </p>
          )}

          <form className="mt-6 space-y-4" onSubmit={handleLogin}>
            <div>
              <label className="text-sm font-semibold text-primary">Correo electrónico</label>
              <input
                name="user"
                type="email"
                required
                placeholder="ej. usuario@correo.com"
                className="mt-1 w-full rounded-xl border border-white/50 bg-white/50 backdrop-blur px-3 py-3 text-sm focus:border-primary focus:outline-none shadow-sm"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-primary">Contraseña</label>
              <input
                name="pass"
                type="password"
                required
                placeholder="••••••••"
                className="mt-1 w-full rounded-xl border border-white/50 bg-white/50 backdrop-blur px-3 py-3 text-sm focus:border-primary focus:outline-none shadow-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="mt-8 w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-transform hover:scale-[1.02] shadow-lg shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 size={16} className="animate-spin" /> Verificando…</> : "Ingresar"}
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            ¿No tienes cuenta? Solicítala con tu psicólogo asignado.
          </p>
        </div>
      </section>
    );
  }

  // ── Vista: enrutador dinámico de dashboard ────────────────────────────
  switch (profile.role) {
    case "admin":
      return <AdminDashboard profile={profile} onLogout={handleLogout} />;
    case "therapist":
      return <TherapistDashboard profile={profile} onLogout={handleLogout} />;
    case "patient":
    default:
      return <PatientDashboard profile={profile} onLogout={handleLogout} />;
  }
}
