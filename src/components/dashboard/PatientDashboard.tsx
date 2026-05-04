import { useState, useEffect } from "react";
import { LogOut, Calendar, Pencil, BookOpen, Moon, Activity } from "lucide-react";
import { supabase, type Profile, type ClinicalRecommendation } from "../../lib/supabase";

interface Props {
  profile: Profile;
  onLogout: () => void;
}

export function PatientDashboard({ profile, onLogout }: Props) {
  const [recommendations, setRecommendations] = useState<ClinicalRecommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRecommendations() {
      const { data, error } = await supabase
        .from("clinical_recommendations")
        .select("*")
        .eq("patient_id", profile.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setRecommendations(data);
      }
      setLoading(false);
    }
    fetchRecommendations();
  }, [profile.id]);

  const displayName = profile.full_name ?? profile.id.slice(0, 8);
  const planLabel = { free: "Plan Gratuito", esencial: "Plan Esencial", integral: "Plan Integral", premium: "Plan Premium" }[profile.plan_type] ?? "Plan Gratuito";
  const isSubscriptionActive = profile.subscription_status === "activate";

  return (
    <>
      <section className="gradient-soft border-b border-white/30 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
          <div className="flex items-center justify-between glass-card p-6 rounded-3xl border border-white/40 shadow-sm">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Bienvenido/a</p>
              <h1 className="text-3xl font-bold text-primary drop-shadow-sm">{displayName}</h1>
              <span className="mt-1 inline-block rounded-full bg-primary/10 border border-primary/20 px-3 py-0.5 text-xs font-semibold text-primary">
                {planLabel}
              </span>
            </div>
            <button
              onClick={onLogout}
              className="rounded-xl border border-white/50 bg-white/40 backdrop-blur px-4 py-2 text-sm font-bold text-primary hover:bg-white/60 transition-colors shadow-sm flex items-center gap-2"
            >
              <LogOut size={16} /> Cerrar sesión
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Panel izquierdo: info del plan */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card-neon-hover rounded-3xl glass-card p-6 border border-white/40">
              <h2 className="text-lg font-bold text-primary mb-1">Tu plan actual</h2>
              <p className="text-sm text-muted-foreground">
                Estado de suscripción:{" "}
                <span className={`font-semibold ${isSubscriptionActive ? "text-emerald-600" : "text-amber-600"}`}>
                  {isSubscriptionActive ? "Activo" : "Inactivo"}
                </span>
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                Accede a más contenido clínico, guías premium y sesiones con tu terapeuta asignado mejorando tu plan.
              </p>
            </div>
          </div>

          {/* Panel derecho: recomendaciones dinámicas */}
          <div>
            <h2 className="text-xl font-bold text-primary drop-shadow-sm flex items-center gap-2">
              <Activity size={20} />
              Recomendaciones
            </h2>
            <div className="mt-4 space-y-4">
              {loading ? (
                <p className="text-sm text-muted-foreground animate-pulse">Cargando...</p>
              ) : recommendations.length > 0 ? (
                recommendations.map((r) => (
                  <div key={r.id} className="card-neon-hover flex items-start gap-4 rounded-3xl glass-card p-5 transition-transform hover:translate-x-1 hover:shadow-md">
                    <div className="text-primary bg-primary/10 p-3 rounded-xl border border-primary/20 backdrop-blur">
                      <Calendar size={22} strokeWidth={1.5} />
                    </div>
                    <div className="pt-1">
                      <p className="text-sm font-bold text-primary">{r.title}</p>
                      <p className="text-xs font-medium text-muted-foreground mt-1">{r.frequency}</p>
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{r.description}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl glass-card p-5 text-center border border-white/40 border-dashed">
                  <p className="text-sm text-muted-foreground">Tu terapeuta aún no te ha asignado recomendaciones.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
