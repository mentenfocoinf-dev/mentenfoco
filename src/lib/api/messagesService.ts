// ============================================================================
// Servicio de mensajería directa paciente↔terapeuta (tabla `messages`).
// Backend verificado contra Supabase real el 2026-07-17 (migración
// supabase/20260717_create_messages.sql: constraints de participante y cuerpo
// no vacío probados, realtime habilitado). La conversación es el par
// (patient_id, therapist_id); cada mensaje guarda quién lo envió (sender_id).
// ============================================================================
import { supabase } from "../supabase";
import { trackEvent } from "./journeyService";
import { getRelationship, type Relationship } from "./patientTherapistService";

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
export async function getConversationByPair(
  patientId: string,
  therapistId: string,
): Promise<Message[]> {
  const { data, error } = await supabase.rpc("list_pair_messages", {
    p_patient_id: patientId,
    p_therapist_id: therapistId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as Message[];
}

// Terapeuta asignado a un paciente (o null si aún no tiene). Útil para que la UI del paciente
// sepa con quién chatea sin traer toda la conversación.
export async function getAssignedTherapistId(patientId: string): Promise<string | null> {
  const { data } = await supabase.rpc("get_assigned_therapist");
  return (data as string | null) ?? null;
}

// Conversación del paciente con su terapeuta asignado. Devuelve therapistId nulo
// si el paciente aún no tiene terapeuta asignado (no hay con quién chatear).
export async function getPatientConversation(
  patientId: string,
): Promise<{ therapistId: string | null; messages: Message[] }> {
  // Lectura por función: el cliente ya no consulta patient_therapist.
  const { data: asignado } = await supabase.rpc("get_assigned_therapist");
  const therapistId = (asignado as string | null) ?? null;
  if (!therapistId) return { therapistId: null, messages: [] };

  const messages = await getConversationByPair(patientId, therapistId);
  return { therapistId, messages };
}

export async function sendMessageByPair(params: {
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
export async function markConversationAsReadByPair(
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

// ── Contadores de no leídos (para el badge global fuera de la pantalla de mensajes) ─────────────
export async function getPatientUnreadCount(patientId: string): Promise<number> {
  // La función cuenta los del propio usuario; el parámetro se conserva para no
  // cambiar la firma de los consumidores.
  void patientId;
  const { data, error } = await supabase.rpc("count_my_unread_messages");
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

export async function getTherapistUnreadCount(therapistId: string): Promise<number> {
  void therapistId;
  const { data, error } = await supabase.rpc("count_my_unread_messages");
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

// ── Bandeja del terapeuta ────────────────────────────────────────────────────
// El resumen por paciente —último mensaje y no leídos— lo agrega ahora la base:
// antes se traían TODOS los mensajes del terapeuta al cliente para reducirlos
// aquí, lo que además de inseguro movía mucha más información de la necesaria.
export async function getTherapistConversations(
  therapistId: string,
): Promise<TherapistConversation[]> {
  void therapistId; // la función filtra por auth.uid()
  const { data, error } = await supabase.rpc("list_my_conversations");
  if (error) throw new Error(error.message);
  return (data ?? []) as TherapistConversation[];
}

// ============================================================================
// Conversación atada a la relación formal.
//
// Las funciones de arriba son las del modelo anterior, donde la conversación
// era el PAR (paciente, terapeuta): siguen ahí porque cinco componentes las
// usan, y llevan el sufijo `ByPair` para que no se confundan con estas.
//
// Estas cuatro trabajan sobre `relationship_id`, que es lo correcto: dos
// procesos distintos con el mismo profesional son dos conversaciones, no una.
//
// Las reglas viven en la base:
//   · `sender_id` se ignora si llega del cliente — lo pone auth.uid();
//   · solo escriben las dos partes, y solo con la relación activa;
//   · un mensaje enviado no se edita ni se borra: del UPDATE solo pasa read_at.
// ============================================================================

/** Un mensaje dentro de una conversación. */
export interface ConversationMessage {
  id: string;
  relationshipId: string;
  senderId: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

const MAX_MENSAJE = 4000;

const MENSAJES_DE_ERROR: [string, string][] = [
  ["MESSAGE_APPEND_ONLY", "Un mensaje enviado no se puede borrar."],
  ["MESSAGE_IMMUTABLE", "Un mensaje enviado no se puede editar."],
  ["MESSAGE_RELATIONSHIP_CLOSED", "Esta conversación está cerrada."],
  ["MESSAGE_NO_RELATIONSHIP", "Esta conversación no existe."],
  ["MESSAGE_FORBIDDEN", "Esta conversación no es tuya."],
];

function traducirMensaje(mensaje: string): Error {
  const encontrado = MENSAJES_DE_ERROR.find(([codigo]) => mensaje.includes(codigo));
  return new Error(encontrado ? encontrado[1] : "No se pudo completar la operación.");
}

/**
 * Envía un mensaje.
 *
 * No recibe remitente: quién escribe lo decide la sesión en la base. Un
 * parámetro de autoría sería una puerta para firmar en nombre de otro.
 */
export async function sendMessage(relationshipId: string, message: string): Promise<void> {
  const texto = message.trim();
  if (!texto) throw new Error("El mensaje no puede estar vacío.");

  const { error } = await supabase.from("messages").insert({
    relationship_id: relationshipId,
    body: texto.slice(0, MAX_MENSAJE),
  });
  if (error) throw traducirMensaje(error.message);

  trackEvent("MESSAGE_SENT", { resource_id: relationshipId, resource_type: "conversacion" });
}

/** Los mensajes de una conversación, en orden cronológico. */
export async function listMessages(relationshipId: string): Promise<ConversationMessage[]> {
  const { data, error } = await supabase.rpc("list_relationship_messages", {
    p_relationship_id: relationshipId,
  });
  if (error || !data) return [];

  return (data as Record<string, string | null>[]).map((m) => ({
    id: m.id as string,
    relationshipId: m.relationship_id as string,
    senderId: m.sender_id as string,
    message: (m.body as string) ?? "",
    readAt: m.read_at,
    createdAt: m.created_at as string,
  }));
}

/** Marca como leídos los mensajes que NO envió quien lee. */
export async function markAsRead(relationshipId: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const lector = session?.user?.id;
  if (!lector) return;

  const { error } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("relationship_id", relationshipId)
    .neq("sender_id", lector)
    .is("read_at", null);
  if (error) throw traducirMensaje(error.message);

  trackEvent("MESSAGE_READ", { resource_id: relationshipId, resource_type: "conversacion" });
}

/**
 * La conversación completa: con quién es y qué se ha dicho.
 *
 * `relationship` en `null` significa que no existe o que quien pregunta no es
 * parte — la base no distingue entre las dos cosas, y hace bien.
 */
export async function getConversation(
  relationshipId: string,
): Promise<{ relationship: Relationship | null; messages: ConversationMessage[] }> {
  const relationship = await getRelationship(relationshipId);
  if (!relationship) return { relationship: null, messages: [] };
  return { relationship, messages: await listMessages(relationshipId) };
}
