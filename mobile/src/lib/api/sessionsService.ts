// Agenda de sesiones (therapy_sessions). Idéntico a src/lib/api/sessionsService.ts de la web —
// mismo esquema, mismas funciones. Backend ya verificado y en producción.
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

export async function getPatientSessions(patientId: string): Promise<TherapySession[]> {
  const { data, error } = await supabase
    .from("therapy_sessions")
    .select("*")
    .eq("patient_id", patientId)
    .order("scheduled_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}
