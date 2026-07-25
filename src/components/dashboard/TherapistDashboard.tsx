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
  Settings,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase, type Profile } from "../../lib/supabase";
import { CrisisAlertResolutionModal } from "./CrisisAlertResolutionModal";
import { CognitiveScreeningForm } from "../CognitiveScreeningForm";
import { TherapistMessages } from "../messaging/TherapistMessages";
import { WeeklyAgenda } from "../agenda/WeeklyAgenda";
import { DashboardShell, type ShellNavItem } from "./DashboardShell";
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
  type TherapistSessionRow,
  type SessionStatus,
  type TherapistConversation,
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

  const NAV: ShellNavItem[] = [
    { key: "inicio", label: "Inicio", icon: Home },
    { key: "pacientes", label: "Pacientes", icon: Users },
    { key: "agenda", label: "Agenda", icon: Calendar },
    { key: "historia", label: "Historia Clínica", icon: FileText },
    { key: "documentos", label: "Documentos Clínicos", icon: FolderOpen },
    {
      key: "alertas",
      label: "Alertas",
      icon: AlertTriangle,
      badge: crisisAlerts.length,
    },
    { key: "mensajes", label: "Mensajes", icon: MessageCircle, badge: unreadMessages },
    { key: "estadisticas", label: "Estadísticas", icon: BarChart3 },
  ];
  const BOTTOM_NAV: ShellNavItem[] = [
    { key: "configuracion", label: "Configuración", icon: Settings },
  ];
  const TITLES: Record<string, string> = {
    inicio: `Hola, ${displayName.split(" ")[0]}`,
    pacientes: "Mis pacientes",
    agenda: "Agenda de sesiones",
    historia: "Historia clínica",
    documentos: "Documentos clínicos",
    alertas: "Alertas de riesgo",
    mensajes: "Mensajes",
    estadisticas: "Estadísticas",
    configuracion: "Configuración",
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

  const estadisticasCard = (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Pacientes asignados", value: patients.length, icon: Users },
          { label: "Sesiones registradas", value: sessions.length, icon: Calendar },
          { label: "Alertas pendientes", value: crisisAlerts.length, icon: AlertTriangle },
          { label: "Mensajes sin leer", value: unreadMessages, icon: MessageCircle },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="card-neon-hover rounded-3xl glass-card border border-white/40 p-5"
          >
            <div className="flex items-center gap-2 text-primary">
              <Icon size={18} strokeWidth={1.75} />
              <p className="text-xs font-semibold uppercase tracking-wider">{label}</p>
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="card-neon-hover rounded-3xl glass-card border border-white/40 p-6">
        <h3 className="text-sm font-bold text-primary mb-4">Sesiones por estado</h3>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay sesiones registradas.</p>
        ) : (
          <ul className="space-y-2">
            {sessionsByStatus.map(({ label, count }) => (
              <li key={label} className="flex items-center justify-between gap-4 text-sm">
                <span className="text-slate-700">{label}</span>
                <span className="font-bold text-primary">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  const configuracionCard = (
    <div className="max-w-2xl">
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
            <dt className="text-muted-foreground">Rol</dt>
            <dd className="font-semibold text-slate-800">Terapeuta</dd>
          </div>
          {profile.professional_card && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Tarjeta profesional</dt>
              <dd className="font-semibold text-slate-800">{profile.professional_card}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );

  const proximasSesiones = sessions
    .filter((s) => s.status !== "cancelada" && new Date(s.scheduled_at).getTime() >= Date.now())
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
    .slice(0, 4);

  const inicioSection = (
    <div className="space-y-6">
      {crisisAlerts.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-red-700">
            <AlertTriangle size={20} /> Alertas de riesgo pendientes ({crisisAlerts.length})
          </h2>
          {alertasBlock}
        </div>
      )}

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
                      dateStyle: "full",
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
    alertas: alertasBlock,
    mensajes: (
      <TherapistMessages
        therapistId={profile.id}
        onConversationsChange={handleConversationsChange}
      />
    ),
    estadisticas: estadisticasCard,
    configuracion: configuracionCard,
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
    </>
  );
}
