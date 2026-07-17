// ============================================================================
// Servicio de mensajería directa paciente↔terapeuta (tabla `messages`).
// Backend verificado contra Supabase real el 2026-07-17 (migración
// supabase/20260717_create_messages.sql: constraints de participante y cuerpo
// no vacío probados, realtime habilitado). La conversación es el par
// (patient_id, therapist_id); cada mensaje guarda quién lo envió (sender_id).
// ============================================================================
import { supabase } from "../supabase";

export interface Message {
  id: string;
  patient_id: string;
  therapist_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

// Fila de la bandeja del terapeuta: último mensaje + no leídos, por paciente.
export interface TherapistConversation {
  patient_id: string;
  patient_name: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

// ── Conversación (par paciente↔terapeuta) ────────────────────────────────────
export async function getConversation(
  patientId: string,
  therapistId: string,
): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("patient_id", patientId)
    .eq("therapist_id", therapistId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Terapeuta asignado a un paciente (o null si aún no tiene). Útil para que la UI del paciente
// sepa con quién chatea sin traer toda la conversación.
export async function getAssignedTherapistId(patientId: string): Promise<string | null> {
  const { data } = await supabase
    .from("patient_therapist")
    .select("therapist_id")
    .eq("patient_id", patientId)
    .maybeSingle();
  return data?.therapist_id ?? null;
}

// Conversación del paciente con su terapeuta asignado. Devuelve therapistId nulo
// si el paciente aún no tiene terapeuta asignado (no hay con quién chatear).
export async function getPatientConversation(
  patientId: string,
): Promise<{ therapistId: string | null; messages: Message[] }> {
  const { data: assignment } = await supabase
    .from("patient_therapist")
    .select("therapist_id")
    .eq("patient_id", patientId)
    .maybeSingle();

  const therapistId = assignment?.therapist_id ?? null;
  if (!therapistId) return { therapistId: null, messages: [] };

  const messages = await getConversation(patientId, therapistId);
  return { therapistId, messages };
}

export async function sendMessage(params: {
  patientId: string;
  therapistId: string;
  senderId: string;
  body: string;
}): Promise<Message> {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      patient_id: params.patientId,
      therapist_id: params.therapistId,
      sender_id: params.senderId,
      body: params.body.trim(),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// Marca como leídos los mensajes de la conversación que NO envió quien lee.
export async function markConversationAsRead(
  patientId: string,
  therapistId: string,
  readerId: string,
): Promise<void> {
  const { error } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("patient_id", patientId)
    .eq("therapist_id", therapistId)
    .neq("sender_id", readerId)
    .is("read_at", null);
  if (error) throw new Error(error.message);
}

// ── Bandeja del terapeuta ────────────────────────────────────────────────────
// Resumen por paciente (último mensaje + no leídos). Se trae la lista de mensajes
// del terapeuta con el nombre del paciente embebido y se reduce en el cliente.
export async function getTherapistConversations(
  therapistId: string,
): Promise<TherapistConversation[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(
      `patient_id, sender_id, body, read_at, created_at,
       patient:profiles!messages_patient_id_fkey (full_name, email)`,
    )
    .eq("therapist_id", therapistId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const byPatient = new Map<string, TherapistConversation>();
  for (const row of (data ?? []) as any[]) {
    const existing = byPatient.get(row.patient_id);
    if (!existing) {
      byPatient.set(row.patient_id, {
        patient_id: row.patient_id,
        patient_name: row.patient?.full_name || row.patient?.email || "Paciente",
        last_message: row.body,
        last_message_at: row.created_at,
        unread_count:
          row.sender_id !== therapistId && row.read_at === null ? 1 : 0,
      });
    } else if (row.sender_id !== therapistId && row.read_at === null) {
      existing.unread_count += 1;
    }
  }
  return Array.from(byPatient.values());
}
