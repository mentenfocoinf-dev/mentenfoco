import { useState, useEffect, useMemo } from "react";
import {
  Home,
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
  Compass,
  UserPlus,
  MessageCircle,
  Stethoscope,
  Library,
  Settings,
  HelpCircle,
  Phone,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase, type Profile } from "../../lib/supabase";
import { PsychometricScaleModal } from "../PsychometricScaleModal";
import { CssrsModal } from "../CssrsModal";
import { PatientMessages } from "../messaging/PatientMessages";
import { WeeklyAgenda } from "../agenda/WeeklyAgenda";
import { PlanUpgradeModal } from "./PlanUpgradeModal";
import { ServiceRequestModal } from "./ServiceRequestModal";
import { DailyQuoteCard } from "./DailyQuoteCard";
import { ClinicalConsentCard } from "./ClinicalConsentCard";
import { MoodTrackerCard } from "./MoodTrackerCard";
import { TrendChart } from "./TrendChart";
import { DashboardShell, type ShellNavItem } from "./DashboardShell";
import { MiCaminoSection } from "./MiCaminoSection";
import { MisSolicitudes } from "./MisSolicitudes";
import { AgendaPaciente } from "./AgendaPaciente";
import { useNovedades } from "../../hooks/useNovedades";
import { NotificacionesBadge } from "../NotificacionesBadge";
import { TuTerapeutaCard } from "./TuTerapeutaCard";
import {
  trackEvent,
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
  getPatientUnreadCount,
  getEvaluationAvailability,
  type EvaluationAvailability,
  type PsychometricEvaluation,
  type TherapySession,
} from "../../lib/api";

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
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [evalAvailability, setEvalAvailability] = useState<EvaluationAvailability>({
    allowed: true,
    availableOn: null,
  });
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [serviceRequestOpen, setServiceRequestOpen] = useState(false);
  const [section, setSection] = useState("inicio");

  // Mismo centro de novedades que el portal del terapeuta.
  const novedades = useNovedades("patient", profile.id);

  const isFreePlan = profile.plan_type === "free";

  async function fetchRecentEvaluations() {
    setRecentEvaluations(await getLatestEvaluationsByScale(profile.id));
    setEvaluationHistory(await getPatientEvaluations(profile.id));
    setEvalAvailability(await getEvaluationAvailability(profile.id, isFreePlan));
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

    getPatientUnreadCount(profile.id)
      .then(setUnreadMessages)
      .catch((err) => console.error("[PatientDashboard] Error cargando no leídos:", err));

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

    // Realtime: mensajes nuevos dirigidos a este paciente, para el badge global del header
    // (independiente de la suscripción propia de PatientMessages/ChatThread).
    const unreadChannel = supabase
      .channel(`patient_unread_badge_${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `patient_id=eq.${profile.id}`,
        },
        (payload) => {
          if (payload.new.sender_id !== profile.id) {
            setUnreadMessages((prev) => prev + 1);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(unreadChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  const displayName = profile.full_name ?? profile.id.slice(0, 8);
  const plan = profile.plan_type ?? "free";
  const planLabel = PLAN_LABELS[plan] ?? PLAN_LABELS.free;
  const isSubscriptionActive = profile.subscription_status === "active";
  const needsPlan = plan === "free" || !isSubscriptionActive;

  const included = benefitsForPlan(plan);
  const locked = lockedBenefitsForPlan(plan);

  const anamnesisData = anamnesis?.data ?? null;

  const upcomingSessions = useMemo(() => {
    const now = Date.now();
    return sessions
      .filter((s) => s.status !== "cancelada" && new Date(s.scheduled_at).getTime() >= now)
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  }, [sessions]);

  const NAV: ShellNavItem[] = [
    { key: "inicio", label: "Inicio", icon: Home },
    // Continuidad: lo que la persona ya empezó, antes que el seguimiento clínico.
    { key: "camino", label: "Mi camino", icon: Compass },
    {
      key: "solicitudes",
      label: "Mis solicitudes",
      icon: UserPlus,
      badge: novedades.porClave.solicitudes,
    },
    { key: "progreso", label: "Mi progreso", icon: TrendingUp },
    // Una sola Agenda. "Mis citas" enseñaba las solicitudes y "Agenda" las
    // sesiones: ninguna contaba el ciclo entero, y una contraoferta no tenía
    // dónde aparecer.
    { key: "agenda", label: "Agenda", icon: Calendar, badge: novedades.porClave.citas },
    { key: "mensajes", label: "Mensajes", icon: MessageCircle, badge: unreadMessages },
    { key: "recursos", label: "Recursos", icon: BookOpen },
    { key: "plan", label: "Mi plan", icon: Sparkles },
    { key: "servicios", label: "Servicios adicionales", icon: Stethoscope },
  ];
  const BOTTOM_NAV: ShellNavItem[] = [
    { key: "ajustes", label: "Ajustes", icon: Settings },
    { key: "ayuda", label: "Ayuda", icon: HelpCircle },
  ];
  const TITLES: Record<string, string> = {
    inicio: `Hola, ${displayName.split(" ")[0]}`,
    camino: "Mi camino",
    solicitudes: "Mis solicitudes de contacto",
    citas: "Mis citas",
    progreso: "Mi progreso",
    agenda: "Agenda",
    mensajes: "Mensajes",
    recursos: "Recursos",
    plan: "Mi plan",
    servicios: "Servicios adicionales",
    ajustes: "Ajustes",
    ayuda: "Ayuda",
  };

  // ── Bloques de contenido reutilizados en las secciones ────────────────────
  const agendaCard = (
    <div className="card-neon-hover rounded-3xl glass-card p-6 border border-white/40">
      <h2 className="text-lg font-bold text-primary mb-1 flex items-center gap-2">
        <Calendar size={20} /> Próximas sesiones
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Estas son las sesiones que tu terapeuta ha programado contigo.
      </p>
      <div className="mb-5">
        <WeeklyAgenda
          items={sessions.map((s) => ({
            id: s.id,
            scheduled_at: s.scheduled_at,
            duration_minutes: s.duration_minutes,
            status: s.status,
            label: "Tu sesión",
            video_call_link: s.video_call_link,
          }))}
        />
      </div>
      {/* Un vistazo, no una segunda agenda. La ficha de cada sesión —enlace,
          estado, ciclo de vida— vive solo en Agenda: tenerla también aquí era
          repetir el mismo hecho en dos sitios que podían no coincidir. */}
      {upcomingSessions.length === 0 && (
        <p className="mb-4 text-sm text-muted-foreground">Aún no tienes sesiones programadas.</p>
      )}
      <button
        type="button"
        onClick={() => setSection("agenda")}
        className="inline-flex items-center gap-1.5 rounded-xl border border-primary/20 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/10"
      >
        Ver mi agenda <ArrowRight size={14} />
      </button>
    </div>
  );

  const planCard = (
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
          {isSubscriptionActive ? "Acompañamiento activo" : "Acompañamiento en pausa"}
        </span>
      </div>
      <p className="text-sm text-muted-foreground mb-4">Esto es lo que incluye {planLabel}:</p>
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
          <button
            onClick={() => setUpgradeOpen(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25"
          >
            Mejorar mi plan <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  );

  const needsPlanBanner = needsPlan && (
    <div className="rounded-3xl glass-card border border-primary/20 bg-primary/5 p-8">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={20} className="text-amber-500" />
        <h2 className="text-xl font-bold text-primary">Actualmente estás en {PLAN_LABELS.free}</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
        Cuando quieras dar el siguiente paso, elige la etapa que mejor se ajuste a tu momento.
        Puedes avanzar hacia más contenido o hacia el acompañamiento con especialistas.
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
  );

  const evaluacionesCard = (
    <div className="card-neon-hover rounded-3xl glass-card p-6 border border-white/40">
      <h2 className="text-lg font-bold text-primary mb-1 flex items-center gap-2">
        <ClipboardCheck size={20} /> Evaluaciones de bienestar
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Cuestionarios breves y validados clínicamente que ayudan a tu terapeuta a hacer seguimiento
        de tu evolución.
        {isFreePlan && (
          <span className="mt-1 block text-xs">
            Tu plan gratuito incluye una evaluación de bienestar al mes. La evaluación de seguridad
            está siempre disponible.
          </span>
        )}
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
          const isLimited = scaleKey !== "cssrs";
          const blocked = isLimited && !evalAvailability.allowed;
          return (
            <div
              key={scaleKey}
              className="glow-hover rounded-2xl border border-white/50 bg-white/50 p-4 backdrop-blur hover:border-primary/30"
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
                disabled={blocked}
                className="mt-3 w-full rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
              >
                {blocked ? "No disponible aún" : recent ? "Volver a evaluar" : "Empezar evaluación"}
              </button>
              {blocked && evalAvailability.availableOn && (
                <p className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] font-semibold text-amber-700">
                  <Lock size={11} />
                  Disponible el{" "}
                  {evalAvailability.availableOn.toLocaleDateString("es-CO", {
                    day: "numeric",
                    month: "long",
                  })}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const progresoCard = (
    <div className="card-neon-hover rounded-3xl glass-card p-6 border border-white/40">
      <h2 className="text-lg font-bold text-primary mb-1 flex items-center gap-2">
        <TrendingUp size={20} /> Progreso en el tiempo
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Evolución de tus puntajes PHQ-9 y GAD-7 a lo largo de tus evaluaciones.
      </p>
      <TrendChart
        evaluations={evaluationHistory}
        emptyMessage="Aún no hay suficientes evaluaciones PHQ-9 o GAD-7 para mostrar una tendencia. Completa al menos dos evaluaciones para ver tu progreso aquí."
      />
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
  );

  const anamnesisCard = (
    <div className="card-neon-hover rounded-3xl glass-card p-6 border border-white/40">
      <h2 className="text-lg font-bold text-primary mb-1 flex items-center gap-2">
        <FileText size={20} /> Tu anamnesis
      </h2>
      {anamnesisData ? (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            Completada el{" "}
            {anamnesis?.completed_at ? new Date(anamnesis.completed_at).toLocaleDateString() : "—"}.
            Este es un resumen de solo lectura; si necesitas corregir algo, coméntaselo a tu
            terapeuta.
          </p>
          <dl className="grid gap-3 sm:grid-cols-2">
            {typeof anamnesisData.motivo_consulta === "string" && anamnesisData.motivo_consulta && (
              <div className="rounded-xl bg-white/50 p-3 sm:col-span-2">
                <dt className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Motivo de consulta
                </dt>
                <dd className="mt-1 text-sm text-slate-700">{anamnesisData.motivo_consulta}</dd>
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
                <dd className="mt-1 text-sm text-slate-700">{anamnesis.audit_c_score} pts</dd>
              </div>
            )}
          </dl>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/40 p-4">
          <p className="text-sm text-muted-foreground mb-3">
            Aún no has completado tu formulario de anamnesis. Es importante para que tu terapeuta
            conozca tu historia clínica antes de tu primera sesión.
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
  );

  const recomendacionesCard = (
    <div>
      <h2 className="text-lg font-bold text-primary flex items-center gap-2">
        <Activity size={20} /> Recomendaciones de tu terapeuta
      </h2>
      <div className="mt-4 space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground animate-pulse">Cargando...</p>
        ) : recommendations.length > 0 ? (
          <div className="space-y-6">
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
  );

  const recursosCard = (
    <div className="grid max-w-4xl gap-4 sm:grid-cols-2">
      <Link
        to="/contenido"
        className="glow-hover group block rounded-3xl glass-card p-6 border border-white/40 hover:border-primary/40"
      >
        <div className="flex items-start gap-3">
          <div className="text-primary bg-primary/10 p-3 rounded-xl border border-primary/20 shrink-0">
            <Library size={22} strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-primary">Explorar contenido</p>
            <p className="text-sm text-muted-foreground">
              Artículos, programas, herramientas y meditaciones.
            </p>
          </div>
          <ArrowRight
            size={18}
            className="ml-auto shrink-0 text-primary group-hover:translate-x-1 transition-transform"
          />
        </div>
      </Link>

      <Link
        to="/guia"
        className="glow-hover group block rounded-3xl glass-card p-6 border border-white/40 hover:border-primary/40"
      >
        <div className="flex items-start gap-3">
          <div className="text-primary bg-primary/10 p-3 rounded-xl border border-primary/20 shrink-0">
            <BookOpen size={22} strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-primary">Guías de bienestar</p>
            <p className="text-sm text-muted-foreground">
              Recursos prácticos escritos por nuestro equipo clínico.
            </p>
          </div>
          <ArrowRight
            size={18}
            className="ml-auto shrink-0 text-primary group-hover:translate-x-1 transition-transform"
          />
        </div>
      </Link>
    </div>
  );

  const serviciosCard = (
    <div className="max-w-2xl">
      <button
        onClick={() => {
          // Intención, no reserva: se registra al abrir, no al enviar.
          trackEvent("SESSION_BOOKING_STARTED");
          setServiceRequestOpen(true);
        }}
        className="group w-full rounded-3xl border border-primary/20 bg-primary p-6 text-left shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/30"
      >
        <div className="flex items-center gap-3">
          <div className="shrink-0 rounded-xl border border-white/20 bg-white/10 p-3 text-white">
            <Stethoscope size={22} strokeWidth={1.5} />
          </div>
          <div>
            <p className="font-bold text-white">Solicitar servicio adicional</p>
            <p className="text-sm text-white/70">
              Consulta extra, valoración neuropsicológica o aplicación de pruebas.
            </p>
          </div>
          <ArrowRight
            size={18}
            className="ml-auto text-white transition-transform group-hover:translate-x-1"
          />
        </div>
      </button>
      <p className="mt-4 text-sm text-muted-foreground">
        Estos servicios están por fuera de lo que incluye tu plan. Al solicitarlos, nuestro equipo
        te contacta para coordinar la fecha y el costo.
      </p>
    </div>
  );

  const ajustesCard = (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-3xl glass-card border border-white/40 p-6">
        <h2 className="text-lg font-bold text-primary mb-4">Tu cuenta</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Nombre</dt>
            <dd className="font-semibold text-slate-800">{profile.full_name ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Correo</dt>
            <dd className="font-semibold text-slate-800">{profile.email ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Plan</dt>
            <dd className="font-semibold text-slate-800">{planLabel}</dd>
          </div>
        </dl>
        <Link
          to="/completar-perfil"
          className="mt-5 inline-flex items-center gap-2 rounded-xl border border-primary/20 px-4 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-primary/10"
        >
          Editar mis datos <ArrowRight size={14} />
        </Link>
      </div>

      {/* Consentimiento clínico (Ley 1090). Se oculta solo si no hay proceso
          abierto: una cuenta que solo lee contenido no tiene qué revocar. */}
      <ClinicalConsentCard profile={profile} />
    </div>
  );

  const ayudaCard = (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-3xl glass-card border border-white/40 p-6">
        <h2 className="text-lg font-bold text-primary">¿Necesitas ayuda?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Estamos para acompañarte. Escríbenos o consulta las preguntas frecuentes.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            to="/contactanos"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Contáctanos
          </Link>
          <Link
            to="/faq"
            className="inline-flex items-center gap-2 rounded-xl border border-primary/20 px-4 py-2.5 text-sm font-bold text-primary hover:bg-primary/10 transition-colors"
          >
            Preguntas frecuentes
          </Link>
        </div>
      </div>
      <div className="rounded-3xl border-2 border-red-200 bg-red-50 p-6">
        <div className="flex items-center gap-2 text-red-800">
          <Phone size={18} />
          <h3 className="font-bold">¿Estás en crisis?</h3>
        </div>
        <p className="mt-2 text-sm text-red-700">
          Si estás en riesgo inmediato, llama al <strong>123</strong>. Consulta más líneas de
          atención gratuitas.
        </p>
        <Link
          to="/lineas-de-crisis"
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 transition-colors"
        >
          Ver líneas de crisis
        </Link>
      </div>
    </div>
  );

  const inicioSection = (
    <div className="space-y-6">
      {needsPlanBanner}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Si no hay relación activa no se dibuja nada. */}
          <TuTerapeutaCard />
          {recomendacionesCard}
          {agendaCard}
        </div>
        <div className="space-y-6">
          <MoodTrackerCard patientId={profile.id} />
          <DailyQuoteCard />
        </div>
      </div>
    </div>
  );

  const sectionContent: Record<string, React.ReactNode> = {
    inicio: inicioSection,
    camino: <MiCaminoSection />,
    solicitudes: <MisSolicitudes />,
    progreso: (
      <div className="space-y-6">
        {evaluacionesCard}
        {progresoCard}
        {anamnesisCard}
      </div>
    ),
    agenda: <AgendaPaciente />,
    mensajes: <PatientMessages patientId={profile.id} onRead={() => setUnreadMessages(0)} />,
    recursos: recursosCard,
    plan: (
      <div className="space-y-6">
        {needsPlanBanner}
        {planCard}
      </div>
    ),
    servicios: serviciosCard,
    ajustes: ajustesCard,
    ayuda: ayudaCard,
  };

  return (
    <>
      <DashboardShell
        nav={NAV}
        bottomNav={BOTTOM_NAV}
        active={section}
        onNavigate={setSection}
        onLogout={onLogout}
        userName={displayName}
        userSubtitle={planLabel}
        title={TITLES[section] ?? "Inicio"}
        topbarRight={
          <>
            <NotificacionesBadge />
            <span className="hidden sm:inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-semibold text-primary">
              {planLabel}
            </span>
          </>
        }
      >
        {sectionContent[section] ?? inicioSection}
      </DashboardShell>

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

      {upgradeOpen && <PlanUpgradeModal profile={profile} onClose={() => setUpgradeOpen(false)} />}

      {serviceRequestOpen && (
        <ServiceRequestModal patientId={profile.id} onClose={() => setServiceRequestOpen(false)} />
      )}

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
