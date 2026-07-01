import { useState, useEffect } from "react";
import {
  LogOut,
  Calendar,
  BookOpen,
  Activity,
  AlertTriangle,
  ClipboardCheck,
} from "lucide-react";
import { supabase, type Profile } from "../../lib/supabase";
import { PsychometricScaleModal } from "../PsychometricScaleModal";
import { CssrsModal } from "../CssrsModal";

interface Props {
  profile: Profile;
  onLogout: () => void;
}

interface RecentEvaluation {
  scale_type: string;
  total_score: number;
  severity_level: string | null;
  evaluated_at: string;
}

export function PatientDashboard({ profile, onLogout }: Props) {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCrisisAlert, setActiveCrisisAlert] = useState(false);
  const [activeScale, setActiveScale] = useState<"phq9" | "gad7" | "cssrs" | null>(null);
  const [recentEvaluations, setRecentEvaluations] = useState<Record<string, RecentEvaluation>>({});

  async function fetchRecentEvaluations() {
    const { data, error } = await supabase
      .from("psychometric_evaluations")
      .select("scale_type, total_score, severity_level, evaluated_at")
      .eq("patient_id", profile.id)
      .order("evaluated_at", { ascending: false });

    if (!error && data) {
      const latestByScale: Record<string, RecentEvaluation> = {};
      for (const evaluation of data as RecentEvaluation[]) {
        if (!latestByScale[evaluation.scale_type]) {
          latestByScale[evaluation.scale_type] = evaluation;
        }
      }
      setRecentEvaluations(latestByScale);
    }
  }

  useEffect(() => {
    // 1. Fetch recommendations
    async function fetchRecommendations() {
      const { data, error } = await supabase
        .from("patient_prescriptions")
        .select(
          `
          id,
          assigned_at,
          completed,
          prescription:clinical_prescriptions (
            titulo,
            objetivo_clinico,
            instruccion_paciente
          )
        `,
        )
        .eq("patient_id", profile.id)
        .order("assigned_at", { ascending: false });

      if (!error && data) {
        setRecommendations(data);
      }
      setLoading(false);
    }
    fetchRecommendations();
    fetchRecentEvaluations();

    // 2. Supabase Realtime Subscription for High Priority Alerts
    const channel = supabase
      .channel("clinical_alerts_channel")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "clinical_alerts",
          filter: `patient_id=eq.${profile.id}`,
        },
        (payload) => {
          if (payload.new.status === "high_priority") {
            setActiveCrisisAlert(true);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile.id]);

  const displayName = profile.full_name ?? profile.id.slice(0, 8);
  const planLabel =
    {
      free: "Plan Gratuito",
      esencial: "Plan Esencial",
      integral: "Plan Integral",
      premium: "Plan Premium",
    }[profile.plan_type] ?? "Plan Gratuito";
  const isSubscriptionActive = profile.subscription_status === "active";

  return (
    <>
      {/* Modal de Crisis de Alta Prioridad */}
      {activeCrisisAlert && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative flex flex-col rounded-3xl bg-white shadow-2xl overflow-hidden max-w-lg w-full text-center animate-in zoom-in-95">
            <div className="bg-red-600 p-6 flex justify-center">
              <AlertTriangle size={64} className="text-white animate-pulse" />
            </div>
            <div className="p-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                Alerta de Prevención Activada
              </h2>
              <p className="text-slate-600 mb-6">
                Hemos detectado indicadores de riesgo en tu evaluación. Tu bienestar es nuestra
                prioridad absoluta. Por favor, comunícate inmediatamente con nuestro equipo de
                soporte clínico o utiliza la línea de emergencia.
              </p>

              <div className="space-y-3">
                <a
                  href="tel:106"
                  className="block w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
                >
                  Llamar a la Línea de Emergencia (106)
                </a>
                <button
                  onClick={() => setActiveCrisisAlert(false)}
                  className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Entendido, buscaré ayuda
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                <span
                  className={`font-semibold ${isSubscriptionActive ? "text-emerald-600" : "text-amber-600"}`}
                >
                  {isSubscriptionActive ? "Activo" : "Inactivo"}
                </span>
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                Accede a más contenido clínico, guías premium y sesiones con tu terapeuta asignado
                mejorando tu plan.
              </p>

            </div>

            <div className="card-neon-hover rounded-3xl glass-card p-6 border border-white/40">
              <h2 className="text-lg font-bold text-primary mb-1 flex items-center gap-2">
                <ClipboardCheck size={20} /> Evaluaciones de bienestar
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Cuestionarios breves y validados clínicamente que ayudan a tu terapeuta a hacer
                seguimiento de tu evolución.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    { key: "phq9", label: "PHQ-9 (Depresión)" },
                    { key: "gad7", label: "GAD-7 (Ansiedad)" },
                    { key: "cssrs", label: "C-SSRS (Seguridad)" },
                  ] as const
                ).map(({ key: scaleKey, label }) => {
                  const recent = recentEvaluations[scaleKey];
                  return (
                    <div
                      key={scaleKey}
                      className="rounded-2xl border border-white/50 bg-white/50 p-4 backdrop-blur"
                    >
                      <p className="text-sm font-bold text-slate-800">{label}</p>
                      {recent ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {scaleKey === "cssrs"
                            ? `Riesgo: ${recent.severity_level}`
                            : `${recent.total_score} pts · ${recent.severity_level}`}{" "}
                          · {new Date(recent.evaluated_at).toLocaleDateString()}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">Sin evaluaciones aún</p>
                      )}
                      <button
                        onClick={() => setActiveScale(scaleKey)}
                        className="mt-3 w-full rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/20 transition-colors"
                      >
                        {recent ? "Volver a evaluar" : "Empezar evaluación"}
                      </button>
                    </div>
                  );
                })}
              </div>
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
                <div className="space-y-6">
                  {/* Última Recomendación */}
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Última Recomendación
                    </h3>
                    <div className="card-neon-hover flex items-start gap-4 rounded-3xl glass-card p-5 transition-transform hover:translate-x-1 hover:shadow-md border-primary/40 bg-primary/5">
                      <div className="text-primary bg-primary/10 p-3 rounded-xl border border-primary/20 backdrop-blur shrink-0">
                        <Calendar size={22} strokeWidth={1.5} />
                      </div>
                      <div className="pt-1 w-full">
                        <div className="flex justify-between items-start gap-4">
                          <p className="text-base font-bold text-primary">
                            {recommendations[0].prescription?.titulo}
                          </p>
                          <span className="text-[10px] text-muted-foreground bg-white/60 px-2 py-1 rounded-md shrink-0 border border-white/40">
                            {new Date(recommendations[0].assigned_at).toLocaleString([], {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-slate-700 mt-2">
                          {recommendations[0].prescription?.objetivo_clinico}
                        </p>
                        <div className="mt-3 bg-white/60 rounded-xl p-3 border border-white/40">
                          <p className="text-sm text-slate-800 italic">
                            "{recommendations[0].prescription?.instruccion_paciente}"
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Historial */}
                  {recommendations.length > 1 && (
                    <details className="group rounded-2xl glass-card border border-white/40 [&_summary::-webkit-details-marker]:hidden">
                      <summary className="flex cursor-pointer items-center justify-between p-4 font-semibold text-primary">
                        <span className="flex items-center gap-2">
                          <BookOpen size={18} />
                          Ver Historial de Tareas ({recommendations.length - 1})
                        </span>
                        <span className="transition duration-300 group-open:-rotate-180">
                          <svg
                            fill="none"
                            height="24"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.5"
                            viewBox="0 0 24 24"
                            width="24"
                          >
                            <path d="M6 9l6 6 6-6"></path>
                          </svg>
                        </span>
                      </summary>
                      <div className="p-4 pt-0 border-t border-white/20 space-y-3 mt-2">
                        {recommendations.slice(1).map((r: any) => (
                          <div
                            key={r.id}
                            className="flex items-start gap-3 rounded-xl bg-white/40 p-4 border border-white/50"
                          >
                            <div className="text-slate-400 shrink-0 mt-1">
                              <Activity size={18} />
                            </div>
                            <div className="w-full">
                              <div className="flex justify-between items-start gap-2">
                                <p className="text-sm font-bold text-slate-700">
                                  {r.prescription?.titulo}
                                </p>
                                <span className="text-[10px] text-muted-foreground shrink-0">
                                  {new Date(r.assigned_at).toLocaleString([], {
                                    dateStyle: "short",
                                    timeStyle: "short",
                                  })}
                                </span>
                              </div>
                              <p className="text-xs font-medium text-slate-500 mt-0.5">
                                {r.prescription?.objetivo_clinico}
                              </p>
                              <p className="text-xs text-slate-600 mt-2 italic">
                                "{r.prescription?.instruccion_paciente}"
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              ) : (
                <div className="rounded-3xl glass-card p-5 text-center border border-white/40 border-dashed">
                  <p className="text-sm text-muted-foreground">
                    Tu terapeuta aún no te ha asignado recomendaciones.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {(activeScale === "phq9" || activeScale === "gad7") && (
        <PsychometricScaleModal
          scaleType={activeScale}
          patientId={profile.id}
          onClose={() => setActiveScale(null)}
          onSaved={() => fetchRecentEvaluations()}
        />
      )}
      {activeScale === "cssrs" && (
        <CssrsModal
          patientId={profile.id}
          onClose={() => setActiveScale(null)}
          onSaved={() => fetchRecentEvaluations()}
        />
      )}
    </>
  );
}
