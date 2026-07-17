import { useState, useEffect, useMemo } from "react";
import {
  LogOut,
  Calendar,
  BookOpen,
  Activity,
  AlertTriangle,
  ClipboardCheck,
  CheckCircle2,
  Lock,
  Sparkles,
  ArrowRight,
  FileText,
  TrendingUp,
  Video,
  Clock,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { supabase, type Profile } from "../../lib/supabase";
import { PsychometricScaleModal } from "../PsychometricScaleModal";
import { CssrsModal } from "../CssrsModal";
import { PatientMessages } from "../messaging/PatientMessages";
import {
  PLAN_LABELS,
  PLAN_OFFERS,
  MEMBERSHIP_TIERS,
  benefitsForPlan,
  lockedBenefitsForPlan,
  buildCheckoutLink,
  getPatientPrescriptions,
  getLatestEvaluationsByScale,
  getPatientEvaluations,
  getPatientAnamnesis,
  getPatientSessions,
  type PsychometricEvaluation,
  type TherapySession,
} from "../../lib/api";

const SESSION_STATUS_LABELS: Record<string, string> = {
  programada: "Programada",
  confirmada: "Confirmada",
  completada: "Completada",
  cancelada: "Cancelada",
  no_asistio: "No asistió",
};

const SCALE_LABELS: Record<string, string> = {
  phq9: "PHQ-9 (Depresión)",
  gad7: "GAD-7 (Ansiedad)",
  cssrs: "C-SSRS (Seguridad)",
  moca: "MoCA (Cognitivo)",
  mmse: "MMSE (Cognitivo)",
};

interface AnamnesisSummary {
  data: Record<string, any>;
  audit_c_score: number | null;
  completed_at: string | null;
}

interface Props {
  profile: Profile;
  onLogout: () => void;
}

export function PatientDashboard({ profile, onLogout }: Props) {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCrisisAlert, setActiveCrisisAlert] = useState(false);
  const [activeScale, setActiveScale] = useState<"phq9" | "gad7" | "cssrs" | null>(null);
  const [recentEvaluations, setRecentEvaluations] = useState<
    Record<string, PsychometricEvaluation>
  >({});
  const [evaluationHistory, setEvaluationHistory] = useState<PsychometricEvaluation[]>([]);
  const [anamnesis, setAnamnesis] = useState<AnamnesisSummary | null>(null);
  const [sessions, setSessions] = useState<TherapySession[]>([]);

  async function fetchRecentEvaluations() {
    setRecentEvaluations(await getLatestEvaluationsByScale(profile.id));
    setEvaluationHistory(await getPatientEvaluations(profile.id));
  }

  useEffect(() => {
    async function fetchData() {
      try {
        const [recs, anamnesisData, sessionsData] = await Promise.all([
          getPatientPrescriptions(profile.id),
          getPatientAnamnesis(profile.id),
          getPatientSessions(profile.id),
          fetchRecentEvaluations(),
        ]);
        setRecommendations(recs);
        setAnamnesis(anamnesisData);
        setSessions(sessionsData);
      } finally {
        setLoading(false);
      }
    }
    fetchData();

    // Suscripción en tiempo real a alertas de alta prioridad
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  const displayName = profile.full_name ?? profile.id.slice(0, 8);
  const plan = profile.plan_type ?? "free";
  const planLabel = PLAN_LABELS[plan] ?? "Plan Gratuito";
  const isSubscriptionActive = profile.subscription_status === "active";
  const needsPlan = plan === "free" || !isSubscriptionActive;

  const included = benefitsForPlan(plan);
  const locked = lockedBenefitsForPlan(plan);

  // Serie de tendencia PHQ-9 / GAD-7 (únicas escalas con puntaje numérico comparable en el tiempo).
  const trendData = useMemo(() => {
    // Agrupamos por día usando la etiqueta local solo para mostrar, y guardamos el timestamp real
    // (ts) para ordenar cronológicamente. No se puede ordenar por la etiqueta d/m/aaaa: new Date()
    // la interpreta como m/d/aaaa y falla, invirtiendo el eje temporal del gráfico.
    const byDate = new Map<string, { date: string; ts: number; phq9?: number; gad7?: number }>();
    for (const ev of evaluationHistory) {
      if (ev.scale_type !== "phq9" && ev.scale_type !== "gad7") continue;
      const d = new Date(ev.evaluated_at);
      const dateKey = d.toLocaleDateString();
      const entry = byDate.get(dateKey) ?? { date: dateKey, ts: d.getTime() };
      entry[ev.scale_type as "phq9" | "gad7"] = ev.total_score;
      byDate.set(dateKey, entry);
    }
    return Array.from(byDate.values()).sort((a, b) => a.ts - b.ts);
  }, [evaluationHistory]);

  const anamnesisData = anamnesis?.data ?? null;

  const upcomingSessions = useMemo(() => {
    const now = Date.now();
    return sessions
      .filter((s) => s.status !== "cancelada" && new Date(s.scheduled_at).getTime() >= now)
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  }, [sessions]);

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
                prioridad absoluta: ya enviamos una alerta directa a tu terapeuta asignado y se
                pondrá en contacto contigo lo antes posible. Si en este momento estás en peligro,
                acude al servicio de urgencias más cercano.
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => setActiveCrisisAlert(false)}
                  className="block w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                >
                  Entendido
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

      {/* ── Sin plan activo: mostrar opciones disponibles ── */}
      {needsPlan && (
        <section className="mx-auto max-w-7xl px-4 pt-12 md:px-6">
          <div className="rounded-3xl glass-card border border-primary/20 bg-primary/5 p-8">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={20} className="text-amber-500" />
              <h2 className="text-xl font-bold text-primary">Aún no tienes un plan activo</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
              Elige el acompañamiento que mejor se ajuste a tu momento. Puedes empezar con una
              membresía de contenido o con un plan de asesoramiento con especialistas.
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              {PLAN_OFFERS.map((offer) => (
                <a
                  key={offer.plan}
                  href={buildCheckoutLink(offer.link, profile)}
                  className={`group rounded-2xl border p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                    offer.highlighted
                      ? "border-primary/40 bg-white shadow-md"
                      : "border-white/60 bg-white/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-primary">{offer.name}</h3>
                    {offer.highlighted && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        Recomendado
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500 min-h-[32px]">{offer.desc}</p>
                  <p className="mt-2">
                    <span className="text-2xl font-bold text-slate-900">{offer.price}</span>
                    <span className="text-xs text-muted-foreground">{offer.period}</span>
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary group-hover:gap-2 transition-all">
                    Elegir {offer.name} <ArrowRight size={14} />
                  </span>
                </a>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span className="text-muted-foreground">
                ¿Prefieres solo el contenido de la plataforma?
              </span>
              {MEMBERSHIP_TIERS.map((t) => (
                <a
                  key={t.name}
                  href={buildCheckoutLink(t.link, profile)}
                  className="font-bold text-primary hover:underline"
                >
                  {t.name} ({t.price}
                  {t.period})
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Panel izquierdo */}
          <div className="lg:col-span-2 space-y-6">
            {/* Próximas sesiones (agenda) */}
            <div className="card-neon-hover rounded-3xl glass-card p-6 border border-white/40">
              <h2 className="text-lg font-bold text-primary mb-1 flex items-center gap-2">
                <Calendar size={20} /> Próximas sesiones
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Estas son las sesiones que tu terapeuta ha programado contigo.
              </p>
              {upcomingSessions.length > 0 ? (
                <div className="space-y-3">
                  {upcomingSessions.slice(0, 5).map((s) => (
                    <div
                      key={s.id}
                      className="flex flex-col gap-2 rounded-2xl border border-white/50 bg-white/50 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-800">
                          {new Date(s.scheduled_at).toLocaleString([], {
                            dateStyle: "full",
                            timeStyle: "short",
                          })}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock size={12} /> {s.duration_minutes} min ·{" "}
                          {SESSION_STATUS_LABELS[s.status] ?? s.status}
                        </p>
                      </div>
                      {s.video_call_link ? (
                        <a
                          href={s.video_call_link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/20 transition-colors border border-primary/20"
                        >
                          <Video size={14} /> Unirme a la videollamada
                        </a>
                      ) : (
                        <span className="shrink-0 text-xs text-slate-400 italic">
                          Enlace de videollamada aún no disponible
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white/40 p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Aún no tienes sesiones programadas. Tu terapeuta las agenda desde su panel.
                  </p>
                </div>
              )}
            </div>

            {/* Tu plan y sus beneficios */}
            <div className="card-neon-hover rounded-3xl glass-card p-6 border border-white/40">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-primary mb-1">Tu plan actual</h2>
                <span
                  className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                    isSubscriptionActive
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : "bg-amber-50 border-amber-200 text-amber-700"
                  }`}
                >
                  {isSubscriptionActive ? "Suscripción activa" : "Suscripción inactiva"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Esto es lo que incluye tu {planLabel.toLowerCase()}:
              </p>

              <ul className="grid gap-2 sm:grid-cols-2">
                {included.map((b) => (
                  <li key={b.label} className="flex items-start gap-2 text-sm" title={b.detail}>
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                    <span className="text-slate-700">{b.label}</span>
                  </li>
                ))}
              </ul>

              {locked.length > 0 && (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-white/50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Disponible al mejorar tu plan
                  </p>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {locked.slice(0, 6).map((b) => (
                      <li
                        key={b.label}
                        className="flex items-start gap-2 text-sm text-slate-400"
                        title={b.detail}
                      >
                        <Lock size={14} className="shrink-0 mt-0.5" />
                        <span>{b.label}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/membresia"
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                  >
                    Mejorar mi plan <ArrowRight size={14} />
                  </Link>
                </div>
              )}
            </div>

            {/* Evaluaciones */}
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

            {/* Progreso en el tiempo */}
            <div className="card-neon-hover rounded-3xl glass-card p-6 border border-white/40">
              <h2 className="text-lg font-bold text-primary mb-1 flex items-center gap-2">
                <TrendingUp size={20} /> Progreso en el tiempo
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Evolución de tus puntajes PHQ-9 y GAD-7 a lo largo de tus evaluaciones.
              </p>

              {trendData.length >= 2 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                      <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: 12, fontSize: 12, border: "1px solid #e2e8f0" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="phq9"
                        name="PHQ-9"
                        stroke="#6366f1"
                        strokeWidth={2}
                        connectNulls
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="gad7"
                        name="GAD-7"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        connectNulls
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Aún no hay suficientes evaluaciones PHQ-9 o GAD-7 para mostrar una tendencia.
                  Completa al menos dos evaluaciones para ver tu progreso aquí.
                </p>
              )}

              {evaluationHistory.length > 0 && (
                <details className="group mt-5 rounded-2xl border border-white/40 bg-white/40 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer items-center justify-between p-4 text-sm font-semibold text-primary">
                    <span>Ver historial completo ({evaluationHistory.length})</span>
                    <span className="transition duration-300 group-open:-rotate-180">
                      <svg
                        fill="none"
                        height="18"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        viewBox="0 0 24 24"
                        width="18"
                      >
                        <path d="M6 9l6 6 6-6"></path>
                      </svg>
                    </span>
                  </summary>
                  <div className="space-y-2 p-4 pt-0">
                    {evaluationHistory.map((ev, idx) => (
                      <div
                        key={`${ev.scale_type}-${ev.evaluated_at}-${idx}`}
                        className="flex items-center justify-between rounded-xl bg-white/60 px-3 py-2 text-xs"
                      >
                        <span className="font-semibold text-slate-700">
                          {SCALE_LABELS[ev.scale_type] ?? ev.scale_type}
                        </span>
                        <span className="text-slate-500">
                          {ev.scale_type === "cssrs"
                            ? `Riesgo: ${ev.severity_level}`
                            : `${ev.total_score} pts · ${ev.severity_level ?? "—"}`}
                        </span>
                        <span className="text-slate-400">
                          {new Date(ev.evaluated_at).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>

            {/* Tu anamnesis */}
            <div className="card-neon-hover rounded-3xl glass-card p-6 border border-white/40">
              <h2 className="text-lg font-bold text-primary mb-1 flex items-center gap-2">
                <FileText size={20} /> Tu anamnesis
              </h2>
              {anamnesisData ? (
                <>
                  <p className="text-sm text-muted-foreground mb-4">
                    Completada el{" "}
                    {anamnesis?.completed_at
                      ? new Date(anamnesis.completed_at).toLocaleDateString()
                      : "—"}
                    . Este es un resumen de solo lectura; si necesitas corregir algo, coméntaselo a
                    tu terapeuta.
                  </p>
                  <dl className="grid gap-3 sm:grid-cols-2">
                    {typeof anamnesisData.motivo_consulta === "string" &&
                      anamnesisData.motivo_consulta && (
                        <div className="rounded-xl bg-white/50 p-3 sm:col-span-2">
                          <dt className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Motivo de consulta
                          </dt>
                          <dd className="mt-1 text-sm text-slate-700">
                            {anamnesisData.motivo_consulta}
                          </dd>
                        </div>
                      )}
                    {typeof anamnesisData.antecedentes_psiquiatricos_personales === "string" &&
                      anamnesisData.antecedentes_psiquiatricos_personales && (
                        <div className="rounded-xl bg-white/50 p-3">
                          <dt className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Antecedentes personales
                          </dt>
                          <dd className="mt-1 text-sm text-slate-700">
                            {anamnesisData.antecedentes_psiquiatricos_personales}
                          </dd>
                        </div>
                      )}
                    {typeof anamnesisData.red_apoyo === "string" && anamnesisData.red_apoyo && (
                      <div className="rounded-xl bg-white/50 p-3">
                        <dt className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Red de apoyo
                        </dt>
                        <dd className="mt-1 text-sm text-slate-700">{anamnesisData.red_apoyo}</dd>
                      </div>
                    )}
                    {anamnesis?.audit_c_score != null && (
                      <div className="rounded-xl bg-white/50 p-3">
                        <dt className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Consumo de alcohol (AUDIT-C)
                        </dt>
                        <dd className="mt-1 text-sm text-slate-700">
                          {anamnesis.audit_c_score} pts
                        </dd>
                      </div>
                    )}
                  </dl>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white/40 p-4">
                  <p className="text-sm text-muted-foreground mb-3">
                    Aún no has completado tu formulario de anamnesis. Es importante para que tu
                    terapeuta conozca tu historia clínica antes de tu primera sesión.
                  </p>
                  <Link
                    to="/anamnesis"
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    Completar anamnesis <ArrowRight size={14} />
                  </Link>
                </div>
              )}
            </div>

            {/* Mensajes con tu terapeuta */}
            <PatientMessages patientId={profile.id} />
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

              {/* Acceso rápido a guías */}
              <Link
                to="/guia"
                className="block rounded-3xl glass-card p-5 border border-white/40 hover:border-primary/40 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="text-primary bg-primary/10 p-3 rounded-xl border border-primary/20 shrink-0">
                    <BookOpen size={20} strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="font-bold text-primary text-sm">Explorar guías clínicas</p>
                    <p className="text-xs text-muted-foreground">
                      {plan === "free"
                        ? "Tienes acceso a las guías gratuitas."
                        : "Tu plan incluye acceso a guías premium."}
                    </p>
                  </div>
                  <ArrowRight
                    size={16}
                    className="ml-auto text-primary group-hover:translate-x-1 transition-transform"
                  />
                </div>
              </Link>
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
