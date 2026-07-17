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

export interface TherapistSessionRow extends TherapySession {
  patient?: { id: string; full_name: string | null; email: string | null } | null;
}

// ── Paciente ─────────────────────────────────────────────────────────────────
export async function getPatientSessions(patientId: string): Promise<TherapySession[]> {
  const { data, error } = await supabase
    .from("therapy_sessions")
    .select("*")
    .eq("patient_id", patientId)
    .order("scheduled_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── Terapeuta ────────────────────────────────────────────────────────────────
export async function getTherapistSessions(therapistId: string): Promise<TherapistSessionRow[]> {
  const { data, error } = await supabase
    .from("therapy_sessions")
    .select(
      `*, patient:profiles!therapy_sessions_patient_id_fkey (id, full_name, email)`,
    )
    .eq("therapist_id", therapistId)
    .order("scheduled_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
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
