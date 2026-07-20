// Mensajería paciente↔terapeuta. Subset del lado paciente de src/lib/api/messagesService.ts.
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

export async function getAssignedTherapistId(patientId: string): Promise<string | null> {
  const { data } = await supabase
    .from("patient_therapist")
    .select("therapist_id")
    .eq("patient_id", patientId)
    .maybeSingle();
  return data?.therapist_id ?? null;
}

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

export async function getPatientUnreadCount(patientId: string): Promise<number> {
  const { count, error } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("patient_id", patientId)
    .neq("sender_id", patientId)
    .is("read_at", null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}
