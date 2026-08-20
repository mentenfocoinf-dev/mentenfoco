// ============================================================================
// Servicio de agenda de sesiones (therapy_sessions). Backend verificado y probado
// contra Supabase real por Claude Code el 2026-07-16 (migración
// supabase/20260716_create_therapy_sessions.sql, RLS probado con usuarios reales).
// Este archivo es la primera pieza de frontend que consume esa tabla — antes de esto
// no existía ninguna UI de agenda, por la regla "backend antes que frontend".
// ============================================================================
import { supabase } from "../supabase";

export type SessionStatus = "programada" | "confirmada" | "completada" | "cancelada" | "no_asistio";
export type ReminderStatus = "pendiente" | "enviado" | "fallido" | "no_aplica";

export interface TherapySession {
  id: string;
  patient_id: string;
  therapist_id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: SessionStatus;
  video_call_link: string | null;
  reminder_status: ReminderStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Detalle que la agenda necesita para enlazar la sesión con su cita.
 *
 * `appointment_id` es null en las sesiones que el profesional programó
 * directamente, sin que hubiera una solicitud detrás. Son mayoría hoy, y por eso
 * la agenda tiene que leer de `therapy_sessions`: leyendo de `appointments` se
 * dejaría fuera casi todo lo agendado.
 */
export interface SessionDetalle extends TherapySession {
  appointment_id: string | null;
}

export interface TherapistSessionRow extends SessionDetalle {
  /**
   * La otra parte: el paciente si mira el profesional, y al revés.
   *
   * `list_my_sessions` ya lo devuelve resuelto. Existe además de `patient`
   * porque la agenda es la misma para los dos portales y "paciente" solo es el
   * nombre correcto en uno de ellos.
   */
  counterpartName: string;
  patient?: { id: string; full_name: string | null; email: string | null } | null;
}

/** Etiquetas de estado de sesión, en un solo sitio. */
export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  programada: "Programada",
  confirmada: "Confirmada",
  completada: "Realizada",
  cancelada: "Cancelada",
  no_asistio: "No asistió",
};

// ── Paciente ─────────────────────────────────────────────────────────────────
export async function getPatientSessions(patientId?: string): Promise<TherapistSessionRow[]> {
  // Por función: devuelve solo las sesiones de quien llama. El parámetro se
  // conserva para no cambiar la firma; el filtro real es auth.uid().
  void patientId;
  const { data, error } = await supabase.rpc("list_my_sessions");
  if (error) throw new Error(error.message);
  return mapearSesiones(data);
}

// ── Terapeuta ────────────────────────────────────────────────────────────────
/**
 * Da forma a lo que devuelve `list_my_sessions`.
 *
 * La función de la base entrega el nombre de la contraparte plano. Aquí se
 * expone como `counterpartName` —el nombre honesto, sirva a quien sirva— y
 * además como el objeto `patient` embebido que espera el panel del profesional
 * desde antes de que la agenda fuera compartida.
 */
function mapearSesiones(data: unknown): TherapistSessionRow[] {
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    ...(r as unknown as SessionDetalle),
    counterpartName: (r.counterpart_name as string) ?? "",
    patient: {
      id: r.patient_id as string,
      full_name: (r.counterpart_name as string) ?? null,
      email: (r.counterpart_email as string) ?? null,
    },
  }));
}

export async function getTherapistSessions(therapistId?: string): Promise<TherapistSessionRow[]> {
  void therapistId;
  const { data, error } = await supabase.rpc("list_my_sessions");
  if (error) throw new Error(error.message);
  return mapearSesiones(data);
}

export async function createSession(params: {
  patientId: string;
  therapistId: string;
  scheduledAt: string; // ISO
  durationMinutes?: number;
  videoCallLink?: string | null;
  notes?: string | null;
}) {
  const { error } = await supabase.from("therapy_sessions").insert({
    patient_id: params.patientId,
    therapist_id: params.therapistId,
    scheduled_at: params.scheduledAt,
    duration_minutes: params.durationMinutes ?? 45,
    video_call_link: params.videoCallLink ?? null,
    notes: params.notes ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function updateSessionStatus(sessionId: string, status: SessionStatus) {
  const { error } = await supabase
    .from("therapy_sessions")
    .update({ status })
    .eq("id", sessionId);
  if (error) throw new Error(error.message);
}

export async function updateSessionVideoLink(sessionId: string, videoCallLink: string) {
  const { error } = await supabase
    .from("therapy_sessions")
    .update({ video_call_link: videoCallLink })
    .eq("id", sessionId);
  if (error) throw new Error(error.message);
}

export async function cancelSession(sessionId: string) {
  return updateSessionStatus(sessionId, "cancelada");
}

// ── Enlace cita ↔ sesión ─────────────────────────────────────────────────────
//
// Confirmar una cita crea su sesión por trigger. Para guardar después el enlace
// de la videollamada hace falta saber cuál es, y eso es lo que resuelve esto.
// La función de la base solo devuelve las sesiones de quien llama.

/** La sesión que nació de una cita, o `null` si todavía no existe. */
export async function getSessionByAppointment(
  appointmentId: string,
): Promise<SessionDetalle | null> {
  const { data, error } = await supabase.rpc("list_my_sessions");
  if (error || !data) return null;
  const fila = (data as Record<string, unknown>[]).find(
    (s) => s.appointment_id === appointmentId,
  );
  return (fila as unknown as SessionDetalle) ?? null;
}

/**
 * Guarda enlace de videollamada y observaciones de una sesión.
 *
 * Se hace en una sola escritura en vez de dos para que el panel de confirmación
 * no pueda dejar la mitad guardada.
 */
export async function updateSessionDetails(
  sessionId: string,
  detalles: { videoCallLink?: string | null; notes?: string | null },
): Promise<void> {
  const fila: Record<string, unknown> = {};
  if (detalles.videoCallLink !== undefined) fila.video_call_link = detalles.videoCallLink;
  if (detalles.notes !== undefined) fila.notes = detalles.notes;
  if (Object.keys(fila).length === 0) return;

  const { error } = await supabase.from("therapy_sessions").update(fila).eq("id", sessionId);
  if (error) throw new Error("No se pudieron guardar los datos de la sesión.");
}
