import { useState, useEffect } from "react";
import {
  LogOut,
  Users,
  Loader2,
  Plus,
  Send,
  BookOpen,
  FileText,
  AlertTriangle,
  X,
  Calendar,
  Video,
  MessageCircle,
} from "lucide-react";
import { supabase, type Profile } from "../../lib/supabase";
import { ClinicalReportModal } from "./ClinicalReportModal";
import { CognitiveScreeningForm } from "../CognitiveScreeningForm";
import { TherapistMessages } from "../messaging/TherapistMessages";
import { WeeklyAgenda } from "../agenda/WeeklyAgenda";
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

  // Modal State
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [activeReportPatient, setActiveReportPatient] = useState<{
    id: string;
    name: string;
  } | null>(null);

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

  // Badge global de mensajes no leídos (visible en el header, fuera de la tarjeta de mensajería).
  const [unreadMessages, setUnreadMessages] = useState(0);

  function handleConversationsChange(conversations: TherapistConversation[]) {
    setUnreadMessages(conversations.reduce((sum, c) => sum + c.unread_count, 0));
  }

  function scrollToMessages() {
    document.getElementById("mensajeria")?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  function dismissCrisisAlert(alertId: string) {
    // Nota: esto solo la quita de la vista local. clinical_alerts no tiene todavía una columna de
    // "resuelto/reconocido" documentada — cuando se agregue, este dismiss debería además hacer un
    // UPDATE del status en la base de datos.
    setCrisisAlerts((prev) => prev.filter((a) => a.id !== alertId));
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

  const openReportModal = (patientId: string, patientName: string) => {
    setActiveReportPatient({ id: patientId, name: patientName });
    setIsReportModalOpen(true);
  };

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

  return (
    <>
      {activeReportPatient && (
        <ClinicalReportModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          patientName={activeReportPatient.name}
          patientId={activeReportPatient.id}
          therapistId={profile.id}
        />
      )}

      {crisisAlerts.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-6 md:px-6">
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
                  <button
                    onClick={() => openReportModal(alert.patient_id, alert.patient_name)}
                    className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 transition-colors"
                  >
                    Ver informe clínico
                  </button>
                  <button
                    onClick={() => dismissCrisisAlert(alert.id)}
                    className="rounded-lg p-2 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                    aria-label="Descartar alerta"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="gradient-soft border-b border-white/30 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
          <div className="flex items-center justify-between glass-card p-6 rounded-3xl border border-white/40 shadow-sm">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Portal del Profesional</p>
              <h1 className="text-3xl font-bold text-primary drop-shadow-sm">{displayName}</h1>
              <span className="mt-1 inline-block rounded-full bg-blue-100 border border-blue-200 px-3 py-0.5 text-xs font-semibold text-blue-700">
                Terapeuta
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={scrollToMessages}
                className="relative rounded-xl border border-white/50 bg-white/40 backdrop-blur px-4 py-2 text-sm font-bold text-primary hover:bg-white/60 transition-colors shadow-sm flex items-center gap-2"
              >
                <MessageCircle size={16} /> Mensajes
                {unreadMessages > 0 && (
                  <span className="absolute -top-2 -right-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unreadMessages}
                  </span>
                )}
              </button>
              <button
                onClick={onLogout}
                className="rounded-xl border border-white/50 bg-white/40 backdrop-blur px-4 py-2 text-sm font-bold text-primary hover:bg-white/60 transition-colors shadow-sm flex items-center gap-2"
              >
                <LogOut size={16} /> Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Panel izquierdo: Mis Pacientes */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-primary drop-shadow-sm flex items-center gap-2">
              <Users size={20} />
              Mis Pacientes
            </h2>
            <div className="card-neon-hover rounded-3xl glass-card p-6 border border-white/40 overflow-hidden">
              {loading ? (
                <p className="text-sm text-muted-foreground animate-pulse">
                  Cargando datos del dashboard...
                </p>
              ) : patients.length > 0 ? (
                <ul className="space-y-4">
                  {patients.map((p) => {
                    const pat = p.patient as any;
                    const patName = pat?.full_name || pat?.email;
                    return (
                      <li
                        key={p.patient_id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white/50 rounded-2xl border border-white/60 shadow-sm transition-transform hover:scale-[1.01]"
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
                        <button
                          onClick={() => openReportModal(p.patient_id, patName)}
                          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/20 transition-colors border border-primary/20"
                        >
                          <FileText size={14} /> Informe Clínico
                        </button>
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
          </div>

          {/* Panel derecho: Formulario Asignar Prescripción */}
          <div>
            <h2 className="text-xl font-bold text-primary drop-shadow-sm flex items-center gap-2">
              <Plus size={20} />
              Asignar Tarea de Intervención
            </h2>
            <div className="mt-6 card-neon-hover rounded-3xl glass-card p-6 border border-white/40">
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
                  <label className="text-sm font-semibold text-primary">
                    1. Seleccionar Paciente
                  </label>
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
                      const options = Array.from(
                        e.target.selectedOptions,
                        (option) => option.value,
                      );
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

                {/* Vista Previa de la Instrucción */}
                {selectedPrescriptions.length > 0 && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 animate-in fade-in slide-in-from-bottom-2">
                    <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2">
                      Tareas Seleccionadas ({selectedPrescriptions.length})
                    </p>
                    <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
                      {selectedPrescriptions.map((sp) => (
                        <div
                          key={sp.id}
                          className="border-b border-primary/10 pb-3 last:border-0 last:pb-0"
                        >
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
                  disabled={
                    submitting || patients.length === 0 || selectedPrescriptionIds.length === 0
                  }
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
          </div>
        </div>
      </section>

      {/* Agenda de sesiones */}
      <section className="mx-auto max-w-7xl px-4 pb-4 md:px-6">
        <h2 className="text-xl font-bold text-primary drop-shadow-sm flex items-center gap-2 mb-6">
          <Calendar size={20} />
          Agenda de sesiones
        </h2>
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Lista de sesiones */}
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
                    <li
                      key={s.id}
                      className="rounded-2xl border border-white/50 bg-white/50 p-4 space-y-2"
                    >
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
                          onChange={(e) =>
                            handleStatusChange(s.id, e.target.value as SessionStatus)
                          }
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
                <p className="text-sm text-muted-foreground">
                  No hay sesiones programadas todavía.
                </p>
              </div>
            )}
          </div>

          {/* Programar nueva sesión */}
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
        </div>
      </section>

      <section id="mensajeria" className="mx-auto max-w-7xl px-4 pb-4 md:px-6 scroll-mt-24">
        <TherapistMessages therapistId={profile.id} onConversationsChange={handleConversationsChange} />
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-4 md:px-6">
        <CognitiveScreeningForm
          therapistId={profile.id}
          patients={patients.map((p) => ({
            id: p.patient_id,
            name: (p.patient as any)?.full_name || (p.patient as any)?.email || "Paciente",
          }))}
        />
      </section>

      {/* Sección Inferior: Catálogo de Tareas Clínicas (Solo Lectura) */}
      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <h2 className="text-xl font-bold text-primary drop-shadow-sm flex items-center gap-2 mb-6">
          <BookOpen size={20} />
          Directorio de Tareas Clínicas
        </h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
            <p className="text-sm text-muted-foreground col-span-3">
              Cargando directorio clínico...
            </p>
          )}
        </div>
      </section>
    </>
  );
}
