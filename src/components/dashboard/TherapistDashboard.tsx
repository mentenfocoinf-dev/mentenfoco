import { useState, useEffect } from "react";
import {
  Home,
  Users,
  Loader2,
  Plus,
  Send,
  BookOpen,
  FileText,
  FolderOpen,
  AlertTriangle,
  Calendar,
  Video,
  MessageCircle,
  ArrowRight,
  BarChart3,
  UserCircle,
  Award,
  Clock,
  Activity,
  PenLine,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase, type Profile } from "../../lib/supabase";
import { CrisisAlertResolutionModal } from "./CrisisAlertResolutionModal";
import { CognitiveScreeningForm } from "../CognitiveScreeningForm";
import { TherapistMessages } from "../messaging/TherapistMessages";
import { WeeklyAgenda } from "../agenda/WeeklyAgenda";
import { DashboardShell, type ShellNavItem } from "./DashboardShell";
import { ContentEditorModal } from "../content/ContentEditorModal";
import {
  getTherapistPatients,
  getPrescriptionsCatalog,
  getHighPriorityAlerts,
  assignPrescriptions,
  getTherapistSessions,
  createSession,
  updateSessionStatus,
  updateSessionVideoLink,
  getTherapistUnreadCount,
  listMyContent,
  submitForReview,
  CONTENT_STATUS_LABELS,
  CONTENT_STATUS_CLASSES,
  CONTENT_TYPE_LABELS,
  type TherapistSessionRow,
  type SessionStatus,
  type TherapistConversation,
  type ContentItem,
} from "../../lib/api";

const SESSION_STATUS_OPTIONS: { value: SessionStatus; label: string }[] = [
  { value: "programada", label: "Programada" },
  { value: "confirmada", label: "Confirmada" },
  { value: "completada", label: "Completada" },
  { value: "cancelada", label: "Cancelada" },
  { value: "no_asistio", label: "No asistió" },
];

interface Props {
  profile: Profile;
  onLogout: () => void;
}

interface CrisisAlert {
  id: string;
  patient_id: string;
  patient_name: string;
  created_at: string;
}

export function TherapistDashboard({ profile, onLogout }: Props) {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [crisisAlerts, setCrisisAlerts] = useState<CrisisAlert[]>([]);
  const [alertToResolve, setAlertToResolve] = useState<CrisisAlert | null>(null);

  // Prescriptions Catalog State
  const [prescriptionsCatalog, setPrescriptionsCatalog] = useState<any[]>([]);

  // Assignment Form State
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedPrescriptionIds, setSelectedPrescriptionIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Agenda de sesiones (therapy_sessions) — backend verificado el 2026-07-16.
  const [sessions, setSessions] = useState<TherapistSessionRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [schedulePatientId, setSchedulePatientId] = useState("");
  const [scheduleDateTime, setScheduleDateTime] = useState("");
  const [scheduleDuration, setScheduleDuration] = useState(45);
  const [scheduleVideoLink, setScheduleVideoLink] = useState("");
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  const [scheduleMsg, setScheduleMsg] = useState("");
  const [scheduleError, setScheduleError] = useState("");
  const [videoLinkDrafts, setVideoLinkDrafts] = useState<Record<string, string>>({});

  // Badge global de mensajes no leídos (se muestra en el ítem "Mensajes" del sidebar).
  const [unreadMessages, setUnreadMessages] = useState(0);

  // Sección activa del sidebar. Sustituye a la navegación por scroll del layout anterior.
  const [section, setSection] = useState("inicio");

  // Propuestas de contenido escritas por este terapeuta.
  const [myContent, setMyContent] = useState<ContentItem[]>([]);
  const [contentEditor, setContentEditor] = useState<{ open: boolean; item: ContentItem | null }>({
    open: false,
    item: null,
  });

  async function refreshMyContent() {
    setMyContent(await listMyContent(profile.id));
  }

  function handleConversationsChange(conversations: TherapistConversation[]) {
    setUnreadMessages(conversations.reduce((sum, c) => sum + c.unread_count, 0));
  }

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const [patientsData, presData] = await Promise.all([
          getTherapistPatients(profile.id),
          getPrescriptionsCatalog(),
        ]);
        setPatients(patientsData);
        fetchCrisisAlerts(patientsData);
        setPrescriptionsCatalog(presData);
      } catch (err) {
        console.error("[TherapistDashboard] Error cargando datos:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboardData();
    fetchSessions();
    refreshMyContent().catch((err) =>
      console.error("[TherapistDashboard] Error cargando mis propuestas:", err),
    );
    getTherapistUnreadCount(profile.id)
      .then(setUnreadMessages)
      .catch((err) => console.error("[TherapistDashboard] Error cargando no leídos:", err));

    // Realtime: cualquier mensaje nuevo dirigido a este terapeuta actualiza el contador global,
    // incluso si la tarjeta de mensajería (que ya tiene su propia suscripción) aún no se montó.
    const unreadChannel = supabase
      .channel(`therapist_unread_badge_${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `therapist_id=eq.${profile.id}`,
        },
        (payload) => {
          if (payload.new.sender_id !== profile.id) {
            setUnreadMessages((prev) => prev + 1);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(unreadChannel);
    };
  }, [profile.id]);

  async function fetchSessions() {
    setSessionsLoading(true);
    try {
      const data = await getTherapistSessions(profile.id);
      setSessions(data);
    } catch (err) {
      console.error("[TherapistDashboard] Error cargando agenda:", err);
    } finally {
      setSessionsLoading(false);
    }
  }

  async function handleScheduleSession(e: React.FormEvent) {
    e.preventDefault();
    setScheduleMsg("");
    setScheduleError("");

    if (!schedulePatientId || !scheduleDateTime) {
      setScheduleError("Selecciona un paciente y una fecha/hora.");
      return;
    }

    setScheduleSubmitting(true);
    try {
      await createSession({
        patientId: schedulePatientId,
        therapistId: profile.id,
        scheduledAt: new Date(scheduleDateTime).toISOString(),
        durationMinutes: scheduleDuration,
        videoCallLink: scheduleVideoLink || null,
      });
      setScheduleMsg("Sesión programada correctamente.");
      setSchedulePatientId("");
      setScheduleDateTime("");
      setScheduleDuration(45);
      setScheduleVideoLink("");
      await fetchSessions();
      setTimeout(() => setScheduleMsg(""), 3000);
    } catch (err) {
      setScheduleError("No se pudo programar la sesión. Verifica tu conexión.");
      console.error(err);
    } finally {
      setScheduleSubmitting(false);
    }
  }

  async function handleStatusChange(sessionId: string, status: SessionStatus) {
    try {
      await updateSessionStatus(sessionId, status);
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, status } : s)));
    } catch (err) {
      console.error("[TherapistDashboard] Error actualizando estado de sesión:", err);
    }
  }

  async function handleSaveVideoLink(sessionId: string) {
    const link = videoLinkDrafts[sessionId];
    if (!link) return;
    try {
      await updateSessionVideoLink(sessionId, link);
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, video_call_link: link } : s)),
      );
    } catch (err) {
      console.error("[TherapistDashboard] Error guardando enlace de videollamada:", err);
    }
  }

  // Carga las alertas de crisis pendientes (status "high_priority") de los pacientes asignados a
  // este terapeuta. clinical_alerts no guarda therapist_id directamente, así que cruzamos por
  // patient_id contra la lista de pacientes ya cargada — mismo patrón usado en AdminDashboard.tsx
  // para evitar depender del nombre exacto de una relación de embed que no está versionada.
  async function fetchCrisisAlerts(patientsList: any[]) {
    const patientIds = patientsList.map((p) => p.patient_id);
    if (patientIds.length === 0) return;
    try {
      const data = await getHighPriorityAlerts(patientIds);
      setCrisisAlerts(data.map((alert) => buildCrisisAlert(alert, patientsList)));
    } catch (err) {
      console.error("[TherapistDashboard] Error cargando alertas de crisis:", err);
    }
  }

  function buildCrisisAlert(
    alert: { id: string; patient_id: string; created_at: string },
    patientsList: any[],
  ): CrisisAlert {
    const match = patientsList.find((p) => p.patient_id === alert.patient_id);
    const pat = match?.patient as any;
    return {
      id: alert.id,
      patient_id: alert.patient_id,
      patient_name: pat?.full_name || pat?.email || "Paciente",
      created_at: alert.created_at,
    };
  }

  // La alerta sale de la bandeja solo después de que el modal persistió la resolución
  // (resolved_at/resolved_by/resolution_action). Sin ese registro no se puede cerrar.
  function handleAlertResolved(alertId: string) {
    setCrisisAlerts((prev) => prev.filter((a) => a.id !== alertId));
    setAlertToResolve(null);
  }

  // Realtime: escucha nuevas alertas de crisis para cualquiera de los pacientes asignados a este
  // terapeuta. clinical_alerts solo tiene patient_id (no therapist_id), así que no podemos filtrar
  // del lado del servidor con el mismo patrón que usa PatientDashboard — filtramos en el cliente
  // contra la lista de pacientes ya asignados.
  useEffect(() => {
    if (patients.length === 0) return;
    const patientIds = new Set(patients.map((p) => p.patient_id));

    const channel = supabase
      .channel("therapist_crisis_alerts_channel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "clinical_alerts" },
        (payload) => {
          const newAlert = payload.new as {
            id: string;
            patient_id: string;
            status: string;
            created_at: string;
          };
          if (newAlert.status !== "high_priority" || !patientIds.has(newAlert.patient_id)) return;
          setCrisisAlerts((prev) => [buildCrisisAlert(newAlert, patients), ...prev]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [patients]);

  async function handleAssignPlan(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMsg("");
    setErrorMsg("");

    if (!selectedPatientId || selectedPrescriptionIds.length === 0) {
      setErrorMsg("Debes seleccionar un paciente y al menos una tarea clínica.");
      setSubmitting(false);
      return;
    }

    try {
      await assignPrescriptions({
        patientId: selectedPatientId,
        therapistId: profile.id,
        prescriptionIds: selectedPrescriptionIds,
      });
      setSuccessMsg("¡Tareas clínicas asignadas correctamente al paciente!");
      setSelectedPrescriptionIds([]);
      setSelectedPatientId("");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setErrorMsg("Hubo un error al asignar las tareas. Verifica tu conexión.");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  const displayName = profile.full_name || profile.email || "Terapeuta";
  const selectedPrescriptions = prescriptionsCatalog.filter((p) =>
    selectedPrescriptionIds.includes(p.id),
  );

  // Alertas y Estadísticas dejaron de ser secciones propias: las alertas viven
  // dentro de Inicio (con toda su lógica intacta) y los indicadores útiles de
  // Estadísticas se integraron al resumen de Inicio para no duplicarlos.
  const NAV: ShellNavItem[] = [
    { key: "inicio", label: "Inicio", icon: Home, badge: crisisAlerts.length },
    { key: "pacientes", label: "Pacientes", icon: Users },
    { key: "agenda", label: "Agenda", icon: Calendar },
    { key: "historia", label: "Historia Clínica", icon: FileText },
    { key: "documentos", label: "Documentos Clínicos", icon: FolderOpen },
    { key: "mensajes", label: "Mensajes", icon: MessageCircle, badge: unreadMessages },
    { key: "contenido", label: "Contenido", icon: PenLine },
  ];
  const BOTTOM_NAV: ShellNavItem[] = [
    { key: "perfil", label: "Mi Perfil", icon: UserCircle },
  ];
  const TITLES: Record<string, string> = {
    inicio: `Hola, ${displayName.split(" ")[0]}`,
    pacientes: "Mis pacientes",
    agenda: "Agenda de sesiones",
    historia: "Historia clínica",
    documentos: "Documentos clínicos",
    mensajes: "Mensajes",
    contenido: "Escribir contenido",
    perfil: "Mi perfil profesional",
  };

  // ── Bloques de contenido, reutilizados entre secciones ────────────────────

  const alertasBlock =
    crisisAlerts.length > 0 ? (
      <div className="space-y-3">
        {crisisAlerts.map((alert) => (
          <div
            key={alert.id}
            className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-red-600 shrink-0 mt-0.5 animate-pulse" />
              <div>
                <p className="text-sm font-bold text-red-800">
                  Alerta de riesgo — {alert.patient_name}
                </p>
                <p className="text-xs text-red-700 mt-0.5">
                  Una evaluación de esta persona indicó riesgo para su seguridad, el{" "}
                  {new Date(alert.created_at).toLocaleString([], {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                  . Contáctala lo antes posible.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
              <Link
                to="/pacientes/$patientId"
                params={{ patientId: alert.patient_id }}
                className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 transition-colors"
              >
                Ver ficha del paciente
              </Link>
              <button
                onClick={() => setAlertToResolve(alert)}
                className="rounded-lg border border-red-300 px-3 py-2 text-xs font-bold text-red-700 transition-colors hover:bg-red-100"
              >
                Registrar atención
              </button>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white/40 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          No hay alertas de riesgo pendientes en tus pacientes.
        </p>
      </div>
    );

  const pacientesListCard = (
    <div className="card-neon-hover rounded-3xl glass-card p-6 border border-white/40 overflow-hidden">
      <h2 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
        <Users size={20} /> Pacientes asignados
      </h2>
      {loading ? (
        <p className="text-sm text-muted-foreground animate-pulse">Cargando pacientes...</p>
      ) : patients.length > 0 ? (
        <ul className="space-y-4">
          {patients.map((p) => {
            const pat = p.patient as any;
            const patName = pat?.full_name || pat?.email;
            return (
              <li key={p.patient_id}>
                {/* Toda la tarjeta navega a la ficha: el informe es uno de los tres
                    tipos de documento que viven dentro de la ficha del paciente. */}
                <Link
                  to="/pacientes/$patientId"
                  params={{ patientId: p.patient_id }}
                  className="glow-hover flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white/50 rounded-2xl border border-white/60 shadow-sm group"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-primary">{patName}</p>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wider ${pat?.subscription_status === "active" ? "bg-emerald-100 border-emerald-200 text-emerald-700" : "bg-amber-100 border-amber-200 text-amber-700"}`}
                      >
                        {pat?.subscription_status === "active" ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Plan: <span className="font-semibold capitalize">{pat?.plan_type}</span>
                    </p>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold text-primary">
                    Ver ficha
                    <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="p-6 text-center border border-white/40 border-dashed rounded-2xl">
          <p className="text-sm text-muted-foreground">
            No tienes pacientes asignados actualmente.
          </p>
        </div>
      )}
    </div>
  );

  const asignarTareaCard = (
    <div className="card-neon-hover rounded-3xl glass-card p-6 border border-white/40">
      <h2 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
        <Plus size={20} /> Asignar tarea de intervención
      </h2>
      {successMsg && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm text-center font-medium animate-in fade-in slide-in-from-top-2">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm text-center font-medium animate-in fade-in slide-in-from-top-2">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleAssignPlan} className="space-y-5">
        <div>
          <label className="text-sm font-semibold text-primary">1. Seleccionar Paciente</label>
          <select
            required
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/50 bg-white/50 backdrop-blur px-3 py-3 text-sm focus:border-primary focus:outline-none shadow-sm"
          >
            <option value="">-- Selecciona un paciente --</option>
            {patients.map((p) => {
              const pat = p.patient as any;
              return (
                <option key={p.patient_id} value={p.patient_id}>
                  {pat?.full_name || pat?.email}
                </option>
              );
            })}
          </select>
        </div>

        <div>
          <label className="text-sm font-semibold text-primary">
            2. Seleccionar Tarea del Catálogo
          </label>
          <select
            required
            multiple
            value={selectedPrescriptionIds}
            onChange={(e) => {
              const options = Array.from(e.target.selectedOptions, (option) => option.value);
              setSelectedPrescriptionIds(options);
            }}
            className="mt-1 w-full rounded-xl border border-white/50 bg-white/50 backdrop-blur px-3 py-3 text-sm focus:border-primary focus:outline-none shadow-sm min-h-[120px]"
          >
            {prescriptionsCatalog.map((pres) => (
              <option
                key={pres.id}
                value={pres.id}
                className="p-2 border-b border-white/20 last:border-0 hover:bg-primary/10"
              >
                {pres.titulo}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground mt-2">
            Mantén presionado Ctrl (o Cmd) para seleccionar múltiples tareas.
          </p>
        </div>

        {selectedPrescriptions.length > 0 && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 animate-in fade-in slide-in-from-bottom-2">
            <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2">
              Tareas Seleccionadas ({selectedPrescriptions.length})
            </p>
            <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
              {selectedPrescriptions.map((sp) => (
                <div key={sp.id} className="border-b border-primary/10 pb-3 last:border-0 last:pb-0">
                  <p className="text-sm font-bold text-slate-800">{sp.titulo}</p>
                  <p className="text-xs text-slate-600 italic mt-1 line-clamp-2">
                    "{sp.instruccion_paciente}"
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || patients.length === 0 || selectedPrescriptionIds.length === 0}
          className="mt-6 w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-transform hover:scale-[1.02] shadow-lg shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Asignando...
            </>
          ) : (
            <>
              <Send size={16} /> Enviar Prescripción
            </>
          )}
        </button>
      </form>
    </div>
  );

  const sesionesListCard = (
    <div className="card-neon-hover rounded-3xl glass-card p-6 border border-white/40">
      <h3 className="text-sm font-bold text-primary mb-4">Sesiones programadas</h3>

      {!sessionsLoading && sessions.length > 0 && (
        <div className="mb-5">
          <WeeklyAgenda
            items={sessions.map((s) => ({
              id: s.id,
              scheduled_at: s.scheduled_at,
              duration_minutes: s.duration_minutes,
              status: s.status,
              label: s.patient?.full_name || s.patient?.email || "Paciente",
              video_call_link: s.video_call_link,
            }))}
          />
        </div>
      )}

      {sessionsLoading ? (
        <p className="text-sm text-muted-foreground animate-pulse">Cargando agenda...</p>
      ) : sessions.length > 0 ? (
        <ul className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
          {sessions.map((s) => {
            const pat = s.patient;
            return (
              <li key={s.id} className="rounded-2xl border border-white/50 bg-white/50 p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      {pat?.full_name || pat?.email || "Paciente"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(s.scheduled_at).toLocaleString([], {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}{" "}
                      · {s.duration_minutes} min
                    </p>
                  </div>
                  <select
                    value={s.status}
                    onChange={(e) => handleStatusChange(s.id, e.target.value as SessionStatus)}
                    className="rounded-lg border border-white/50 bg-white/70 px-2 py-1 text-xs font-semibold text-primary focus:outline-none"
                  >
                    {SESSION_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    placeholder="Enlace de videollamada"
                    defaultValue={s.video_call_link ?? ""}
                    onChange={(e) =>
                      setVideoLinkDrafts((prev) => ({ ...prev, [s.id]: e.target.value }))
                    }
                    className="flex-1 rounded-lg border border-white/50 bg-white/70 px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
                  />
                  <button
                    onClick={() => handleSaveVideoLink(s.id)}
                    className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition-colors border border-primary/20"
                  >
                    <Video size={12} /> Guardar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="p-6 text-center border border-white/40 border-dashed rounded-2xl">
          <p className="text-sm text-muted-foreground">No hay sesiones programadas todavía.</p>
        </div>
      )}
    </div>
  );

  const programarSesionCard = (
    <div className="card-neon-hover rounded-3xl glass-card p-6 border border-white/40">
      <h3 className="text-sm font-bold text-primary mb-4">Programar nueva sesión</h3>
      {scheduleMsg && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm text-center font-medium">
          {scheduleMsg}
        </div>
      )}
      {scheduleError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm text-center font-medium">
          {scheduleError}
        </div>
      )}
      <form onSubmit={handleScheduleSession} className="space-y-4">
        <div>
          <label className="text-sm font-semibold text-primary">Paciente</label>
          <select
            required
            value={schedulePatientId}
            onChange={(e) => setSchedulePatientId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/50 bg-white/50 backdrop-blur px-3 py-3 text-sm focus:border-primary focus:outline-none shadow-sm"
          >
            <option value="">-- Selecciona un paciente --</option>
            {patients.map((p) => {
              const pat = p.patient as any;
              return (
                <option key={p.patient_id} value={p.patient_id}>
                  {pat?.full_name || pat?.email}
                </option>
              );
            })}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-semibold text-primary">Fecha y hora</label>
            <input
              required
              type="datetime-local"
              value={scheduleDateTime}
              onChange={(e) => setScheduleDateTime(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/50 bg-white/50 backdrop-blur px-3 py-3 text-sm focus:border-primary focus:outline-none shadow-sm"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-primary">Duración (min)</label>
            <input
              type="number"
              min={15}
              step={15}
              value={scheduleDuration}
              onChange={(e) => setScheduleDuration(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-white/50 bg-white/50 backdrop-blur px-3 py-3 text-sm focus:border-primary focus:outline-none shadow-sm"
            />
          </div>
        </div>
        <div>
          <label className="text-sm font-semibold text-primary">
            Enlace de videollamada (opcional)
          </label>
          <input
            type="url"
            placeholder="https://meet.google.com/..."
            value={scheduleVideoLink}
            onChange={(e) => setScheduleVideoLink(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/50 bg-white/50 backdrop-blur px-3 py-3 text-sm focus:border-primary focus:outline-none shadow-sm"
          />
        </div>
        <button
          type="submit"
          disabled={scheduleSubmitting}
          className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-transform hover:scale-[1.02] shadow-lg shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {scheduleSubmitting ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Programando...
            </>
          ) : (
            <>
              <Calendar size={16} /> Programar sesión
            </>
          )}
        </button>
      </form>
    </div>
  );

  const catalogoTareasCard = (
    <div>
      <h2 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
        <BookOpen size={20} /> Directorio de tareas clínicas
      </h2>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {prescriptionsCatalog.length > 0 ? (
          prescriptionsCatalog.map((tech) => (
            <div
              key={tech.id}
              className="card-neon-hover flex flex-col justify-between bg-white/40 glass-card p-5 rounded-2xl border border-white/50 shadow-sm transition-all hover:-translate-y-1"
            >
              <div>
                <h3 className="font-bold text-primary mb-2">{tech.titulo}</h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  {tech.objetivo_clinico}
                </p>
              </div>
              <p className="text-xs text-slate-500 border-t border-slate-200/60 pt-3">
                <span className="font-semibold text-slate-400">Instrucción:</span>{" "}
                {tech.instruccion_paciente.substring(0, 100)}...
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground col-span-3">Cargando directorio clínico...</p>
        )}
      </div>
    </div>
  );

  // Los documentos clínicos (valoración / informe / evolución) viven dentro de la
  // ficha de cada paciente, que ya existe como ruta propia. Esta sección es el
  // acceso por paciente a esa ficha; no duplica el gestor de documentos.
  const documentosCard = (
    <div className="space-y-4">
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <p className="text-sm text-slate-700">
          Las valoraciones, informes y evoluciones se crean y consultan dentro de la ficha de cada
          paciente. Selecciona un paciente para abrir su expediente.
        </p>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground animate-pulse">Cargando pacientes...</p>
      ) : patients.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {patients.map((p) => {
            const pat = p.patient as any;
            return (
              <Link
                key={p.patient_id}
                to="/pacientes/$patientId"
                params={{ patientId: p.patient_id }}
                className="glow-hover group flex items-center gap-3 rounded-2xl border border-white/60 bg-white/50 p-4 shadow-sm"
              >
                <div className="shrink-0 rounded-xl border border-primary/20 bg-primary/10 p-3 text-primary">
                  <FolderOpen size={20} strokeWidth={1.5} />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-bold text-primary">
                    {pat?.full_name || pat?.email}
                  </p>
                  <p className="text-xs text-muted-foreground">Ver documentos clínicos</p>
                </div>
                <ArrowRight
                  size={16}
                  className="ml-auto shrink-0 text-primary transition-transform group-hover:translate-x-1"
                />
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/40 p-6 text-center">
          <p className="text-sm text-muted-foreground">No tienes pacientes asignados.</p>
        </div>
      )}
    </div>
  );

  // Contadores derivados de los datos ya cargados en memoria — no hay consultas
  // nuevas ni métricas inventadas.
  const sessionsByStatus = SESSION_STATUS_OPTIONS.map((opt) => ({
    label: opt.label,
    count: sessions.filter((s) => s.status === opt.value).length,
  }));

  // ── Contenido: propuestas escritas por este terapeuta ─────────────────────
  // El terapeuta redacta y envía a revisión; publicar es potestad del admin, y
  // esa regla la impone la base de datos, no esta pantalla.
  const contenidoCard = (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-3xl border border-primary/20 bg-primary/5 p-5">
        <div className="max-w-xl">
          <h2 className="text-lg font-bold text-primary">Ayuda a nutrir el blog</h2>
          <p className="mt-1 text-sm text-slate-600">
            Escribe un artículo, una herramienta o el tema de un audio. Cuando lo envíes, el equipo
            lo revisa y lo publica. Puedes guardarlo como borrador las veces que quieras.
          </p>
        </div>
        <button
          onClick={() => setContentEditor({ open: true, item: null })}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90"
        >
          <Plus size={16} /> Nueva propuesta
        </button>
      </div>

      {myContent.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/40 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Todavía no has propuesto contenido. Empieza por un tema que trabajes seguido en consulta.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {myContent.map((item) => {
            // El autor solo puede editar mientras es borrador o le pidieron cambios.
            const editable = item.status === "borrador" || item.status === "cambios_solicitados";
            return (
              <li
                key={item.id}
                className="rounded-2xl border border-white/60 bg-white/60 p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${CONTENT_STATUS_CLASSES[item.status]}`}
                      >
                        {CONTENT_STATUS_LABELS[item.status]}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        {CONTENT_TYPE_LABELS[item.content_type]} · {item.categoria}
                      </span>
                    </div>
                    <p className="mt-1.5 font-bold text-primary">{item.titulo}</p>
                    <p className="text-xs text-slate-500">{item.resumen_breve}</p>
                  </div>
                  <button
                    onClick={() => setContentEditor({ open: true, item })}
                    className="shrink-0 rounded-lg border border-primary/20 px-3 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/10"
                  >
                    {editable ? "Editar" : "Ver"}
                  </button>
                </div>

                {item.status === "cambios_solicitados" && item.review_notes && (
                  <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50 p-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-orange-700">
                      El equipo pidió cambios
                    </p>
                    <p className="mt-1 text-sm text-orange-800">{item.review_notes}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  // ── Mi Perfil profesional ─────────────────────────────────────────────────
  // Estructura visual del perfil que más adelante alimentará la recomendación
  // de terapeutas a pacientes (filtros por especialidad, enfoque, modalidad,
  // idioma…). Hoy `profiles` solo tiene full_name, avatar_url, email y
  // professional_card: el resto de campos NO existen en la base todavía, así
  // que se muestran vacíos y marcados como pendientes en vez de inventar datos.
  // Cuando exista la migración, cada campo pasa a leerse/escribirse aquí mismo.
  const PERFIL_PENDIENTE: { label: string; hint: string }[] = [
    { label: "Descripción profesional", hint: "Presentación breve para tus pacientes." },
    { label: "Especialidades", hint: "Ej. ansiedad, duelo, neuropsicología." },
    { label: "Enfoques terapéuticos", hint: "Ej. TCC, sistémico, humanista." },
    { label: "Población atendida", hint: "Ej. adultos, adolescentes, adultos mayores." },
    { label: "Modalidad", hint: "Virtual, presencial o mixta." },
    { label: "Idiomas", hint: "Idiomas en los que atiendes." },
    { label: "Formación", hint: "Títulos, posgrados y certificaciones." },
    { label: "Redes profesionales", hint: "Perfiles públicos o sitio web." },
  ];

  const perfilCard = (
    <div className="space-y-6">
      {/* Identidad: los únicos campos que hoy existen en profiles */}
      <div className="card-neon-hover rounded-3xl glass-card border border-white/40 p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="relative shrink-0">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={displayName}
                className="h-24 w-24 rounded-2xl object-cover shadow-sm"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-3xl font-bold text-primary">
                {displayName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              Foto
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-primary">{profile.full_name ?? displayName}</h2>
            <p className="text-sm text-muted-foreground">{profile.email ?? "—"}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                Terapeuta
              </span>
              {profile.professional_card ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  <Award size={12} /> T.P. {profile.professional_card}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
                  <Award size={12} /> Tarjeta profesional sin registrar
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Campos del perfil público, aún sin respaldo en base de datos */}
      <div className="card-neon-hover rounded-3xl glass-card border border-white/40 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-primary">Perfil público</h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Esta información será la que vean los pacientes al buscar especialista, y la que use
              el sistema para recomendarte según su motivo de consulta.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            <Clock size={12} /> Edición próximamente
          </span>
        </div>

        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          {PERFIL_PENDIENTE.map(({ label, hint }) => (
            <div
              key={label}
              className="rounded-2xl border border-dashed border-slate-200 bg-white/50 p-4"
            >
              <dt className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</dt>
              <dd className="mt-1 text-sm text-slate-400 italic">Sin definir</dd>
              <p className="mt-1 text-xs text-slate-400">{hint}</p>
            </div>
          ))}
        </dl>

        <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-500">
          Estos campos todavía no existen en la base de datos, por eso aparecen vacíos y no son
          editables aún. La estructura ya está lista para conectarlos cuando se cree la migración
          del perfil profesional.
        </p>
      </div>
    </div>
  );

  const proximasSesiones = sessions
    .filter((s) => s.status !== "cancelada" && new Date(s.scheduled_at).getTime() >= Date.now())
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
    .slice(0, 4);

  // Actividad reciente construida SOLO con datos ya cargados en memoria
  // (sesiones y alertas). No se añaden consultas nuevas: las tareas asignadas y
  // las escalas respondidas viven en tablas que este panel no carga hoy, así que
  // no se representan aquí en vez de mostrarlas vacías o inventadas.
  const actividadReciente = [
    ...sessions
      .filter(
        (s) =>
          new Date(s.scheduled_at).getTime() <= Date.now() &&
          ["completada", "no_asistio", "cancelada"].includes(s.status),
      )
      .map((s) => ({
        id: `session-${s.id}`,
        at: s.scheduled_at,
        status: s.status,
        who: s.patient?.full_name || s.patient?.email || "Paciente",
      })),
    ...crisisAlerts.map((a) => ({
      id: `alert-${a.id}`,
      at: a.created_at,
      status: "alerta",
      who: a.patient_name,
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 6);

  const ACTIVITY_STYLE: Record<string, { label: string; className: string }> = {
    completada: { label: "Sesión completada", className: "bg-emerald-100 text-emerald-700" },
    no_asistio: { label: "No asistió", className: "bg-amber-100 text-amber-700" },
    cancelada: { label: "Sesión cancelada", className: "bg-slate-100 text-slate-600" },
    alerta: { label: "Alerta de riesgo", className: "bg-red-100 text-red-700" },
  };

  const inicioSection = (
    <div className="space-y-6">
      {/* 1. Alertas de riesgo — integradas aquí; mantienen resolución y ficha */}
      {crisisAlerts.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-red-700">
            <AlertTriangle size={20} /> Alertas de riesgo pendientes ({crisisAlerts.length})
          </h2>
          {alertasBlock}
        </div>
      )}

      {/* 2. Métricas clave */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Pacientes", value: patients.length, icon: Users },
          { label: "Sesiones", value: sessions.length, icon: Calendar },
          { label: "Sin leer", value: unreadMessages, icon: MessageCircle },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-3xl glass-card border border-white/40 p-5">
            <div className="flex items-center gap-2 text-primary">
              <Icon size={18} strokeWidth={1.75} />
              <p className="text-xs font-semibold uppercase tracking-wider">{label}</p>
            </div>
            <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {/* 3. Próximas sesiones */}
        <div className="card-neon-hover rounded-3xl glass-card border border-white/40 p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-primary">
            <Calendar size={20} /> Próximas sesiones
          </h2>
          {sessionsLoading ? (
            <p className="text-sm text-muted-foreground animate-pulse">Cargando agenda...</p>
          ) : proximasSesiones.length > 0 ? (
            <ul className="space-y-3">
              {proximasSesiones.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-col gap-2 rounded-2xl border border-white/50 bg-white/50 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      {s.patient?.full_name || s.patient?.email || "Paciente"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(s.scheduled_at).toLocaleString([], {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}{" "}
                      · {s.duration_minutes} min
                    </p>
                  </div>
                  {s.video_call_link && (
                    <a
                      href={s.video_call_link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/20 transition-colors"
                    >
                      <Video size={14} /> Videollamada
                    </a>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white/40 p-4 text-center">
              <p className="text-sm text-muted-foreground">No tienes sesiones próximas.</p>
            </div>
          )}
        </div>

        {/* 4. Actividad reciente */}
        <div className="card-neon-hover rounded-3xl glass-card border border-white/40 p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-primary">
            <Activity size={20} /> Actividad reciente
          </h2>
          {actividadReciente.length > 0 ? (
            <ul className="space-y-3">
              {actividadReciente.map((item) => {
                const style = ACTIVITY_STYLE[item.status] ?? {
                  label: item.status,
                  className: "bg-slate-100 text-slate-600",
                };
                return (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 rounded-2xl border border-white/50 bg-white/50 p-3"
                  >
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${style.className}`}
                    >
                      {style.label}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">
                      {item.who}
                    </span>
                    <span className="shrink-0 text-xs text-slate-400">
                      {new Date(item.at).toLocaleDateString("es-CO", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white/40 p-4 text-center">
              <p className="text-sm text-muted-foreground">Todavía no hay actividad registrada.</p>
            </div>
          )}
        </div>
      </div>

      {/* 5. Indicadores que antes vivían en Estadísticas */}
      <div className="card-neon-hover rounded-3xl glass-card border border-white/40 p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-primary">
          <BarChart3 size={20} /> Sesiones por estado
        </h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay sesiones registradas.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {sessionsByStatus.map(({ label, count }) => (
              <div
                key={label}
                className="rounded-2xl border border-white/50 bg-white/50 p-4 text-center"
              >
                <p className="text-2xl font-bold text-primary">{count}</p>
                <p className="mt-1 text-xs text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const sectionContent: Record<string, React.ReactNode> = {
    inicio: inicioSection,
    pacientes: (
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {pacientesListCard}
        {asignarTareaCard}
      </div>
    ),
    agenda: (
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {sesionesListCard}
        {programarSesionCard}
      </div>
    ),
    historia: (
      <div className="space-y-6">
        <CognitiveScreeningForm
          therapistId={profile.id}
          patients={patients.map((p) => ({
            id: p.patient_id,
            name: (p.patient as any)?.full_name || (p.patient as any)?.email || "Paciente",
          }))}
        />
        {catalogoTareasCard}
      </div>
    ),
    documentos: documentosCard,
    mensajes: (
      <TherapistMessages
        therapistId={profile.id}
        onConversationsChange={handleConversationsChange}
      />
    ),
    contenido: contenidoCard,
    perfil: perfilCard,
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
        userSubtitle="Terapeuta"
        title={TITLES[section] ?? "Inicio"}
        topbarRight={
          <span className="hidden sm:inline-flex items-center rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
            Terapeuta
          </span>
        }
      >
        {sectionContent[section] ?? inicioSection}
      </DashboardShell>

      {alertToResolve && (
        <CrisisAlertResolutionModal
          alertId={alertToResolve.id}
          patientName={alertToResolve.patient_name}
          therapistId={profile.id}
          onClose={() => setAlertToResolve(null)}
          onResolved={handleAlertResolved}
        />
      )}

      {contentEditor.open && (
        <ContentEditorModal
          authorId={profile.id}
          existing={contentEditor.item}
          readOnly={
            contentEditor.item != null &&
            contentEditor.item.status !== "borrador" &&
            contentEditor.item.status !== "cambios_solicitados"
          }
          onClose={() => {
            setContentEditor({ open: false, item: null });
            void refreshMyContent();
          }}
          onSaved={() => void refreshMyContent()}
          onSubmitForReview={async (id) => {
            await submitForReview(id);
            await refreshMyContent();
          }}
        />
      )}
    </>
  );
}
