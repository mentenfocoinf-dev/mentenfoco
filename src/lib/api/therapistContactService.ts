// ============================================================================
// Solicitudes de contacto paciente → terapeuta.
//
// El Matching Engine dice con quién encajas; esto es pedirlo y que la otra
// parte responda. Siete funciones y ninguna más.
//
// Las reglas NO están aquí. Quién puede crear, cancelar, aceptar o rechazar
// —y qué transiciones existen— lo impone el trigger
// `enforce_contact_request_rules` en la base. Con RLS desactivado, una
// comprobación en el cliente es una sugerencia que cualquiera puede saltarse
// llamando a la API directamente. Esta capa refleja las reglas para que la
// interfaz no ofrezca acciones que el servidor va a rechazar, y traduce los
// códigos del trigger a algo que una persona pueda leer.
//
// La lectura va por RPC: el cliente no tiene SELECT sobre la tabla, y no debe
// tenerlo — quién pidió hablar con qué psicólogo es información de salud.
// ============================================================================
import { supabase } from "../supabase";
import { trackEvent } from "./journeyService";

export type ContactRequestStatus = "pending" | "accepted" | "rejected" | "cancelled";

export const CONTACT_STATUS_LABELS: Record<ContactRequestStatus, string> = {
  pending: "Pendiente",
  accepted: "Aceptada",
  rejected: "No aceptada",
  cancelled: "Cancelada",
};

/** Solicitud vista por el paciente: al otro lado hay un profesional. */
export interface PatientContactRequest {
  id: string;
  therapistProfileId: string;
  therapistName: string;
  status: ContactRequestStatus;
  message: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Solicitud vista por el terapeuta: al otro lado hay un paciente. */
export interface TherapistContactRequest {
  id: string;
  patientId: string;
  patientName: string;
  status: ContactRequestStatus;
  message: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContactRequest {
  id: string;
  patientId: string;
  therapistProfileId: string;
  status: ContactRequestStatus;
  message: string | null;
  createdAt: string;
  updatedAt: string;
}

const MAX_MENSAJE = 1000;

/** Códigos del trigger → frases. Uno solo para no repetirlos en cada función. */
const MENSAJES_DE_ERROR: [string, string][] = [
  ["CONTACT_REQUEST_APPEND_ONLY", "Una solicitud no se borra: se cancela o se rechaza."],
  ["CONTACT_REQUEST_CLOSED", "Esta solicitud ya fue resuelta."],
  ["CONTACT_REQUEST_IMMUTABLE", "Una solicitud enviada no se puede reescribir."],
  ["CONTACT_REQUEST_PATIENT_CAN_ONLY_CANCEL", "Solo puedes cancelar tu solicitud."],
  ["CONTACT_REQUEST_THERAPIST_CAN_ONLY_RESOLVE", "Solo puedes aceptar o rechazar la solicitud."],
  ["CONTACT_REQUEST_INVALID_INITIAL_STATUS", "Una solicitud nace pendiente."],
  ["CONTACT_REQUEST_FORBIDDEN", "Esta solicitud no es tuya."],
  // Índice único parcial: ya hay una abierta con ese profesional.
  ["idx_contact_requests_una_pendiente", "Ya tienes una solicitud pendiente con este profesional."],
  ["duplicate key", "Ya tienes una solicitud pendiente con este profesional."],
];

function traducir(mensaje: string): Error {
  const encontrado = MENSAJES_DE_ERROR.find(([codigo]) => mensaje.includes(codigo));
  return new Error(encontrado ? encontrado[1] : "No se pudo completar la solicitud.");
}

async function idDeSesion(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const id = session?.user?.id;
  if (!id) throw new Error("Necesitas iniciar sesión para gestionar solicitudes.");
  return id;
}

/** Único punto de cambio de estado. Las tres transiciones comparten camino. */
async function cambiarEstado(id: string, status: ContactRequestStatus): Promise<void> {
  const { error } = await supabase
    .from("therapist_contact_requests")
    .update({ status })
    .eq("id", id);
  if (error) throw traducir(error.message);
}

// ── Escritura ───────────────────────────────────────────────────────────────

/**
 * Pide contacto con un profesional.
 *
 * `patient_id` se toma de la sesión y no de un parámetro: si viniera de fuera,
 * la interfaz podría pedir en nombre de otra persona. El trigger lo rechazaría
 * igualmente, pero no hay razón para ofrecer esa puerta.
 */
export async function createContactRequest(
  therapistProfileId: string,
  message?: string | null,
): Promise<void> {
  const patientId = await idDeSesion();

  const { error } = await supabase.from("therapist_contact_requests").insert({
    patient_id: patientId,
    therapist_profile_id: therapistProfileId,
    message: message?.trim() ? message.trim().slice(0, MAX_MENSAJE) : null,
  });
  if (error) throw traducir(error.message);

  trackEvent("CONTACT_REQUEST_CREATED", { resource_id: therapistProfileId, resource_type: "terapeuta" });
}

export async function cancelContactRequest(id: string): Promise<void> {
  await cambiarEstado(id, "cancelled");
  trackEvent("CONTACT_REQUEST_CANCELLED", { resource_id: id, resource_type: "solicitud" });
}

export async function acceptContactRequest(id: string): Promise<void> {
  await cambiarEstado(id, "accepted");
  trackEvent("CONTACT_REQUEST_ACCEPTED", { resource_id: id, resource_type: "solicitud" });
  // Aceptar y quedar asignado son el mismo hecho: el trigger de la base crea la
  // relación dentro de la misma transacción. Si el UPDATE salió bien, existe.
  trackEvent("THERAPIST_ASSIGNED", { resource_id: id, resource_type: "solicitud" });
}

export async function rejectContactRequest(id: string): Promise<void> {
  await cambiarEstado(id, "rejected");
  trackEvent("CONTACT_REQUEST_REJECTED", { resource_id: id, resource_type: "solicitud" });
}

// ── Lectura ─────────────────────────────────────────────────────────────────

/** Las que ha enviado quien tiene la sesión abierta. */
export async function listPatientRequests(): Promise<PatientContactRequest[]> {
  const { data, error } = await supabase.rpc("list_my_contact_requests");
  if (error || !data) return [];
  return (data as Record<string, string>[]).map((r) => ({
    id: r.id,
    therapistProfileId: r.therapist_profile_id,
    therapistName: r.therapist_name ?? "",
    status: r.status as ContactRequestStatus,
    message: r.message ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

/** Las dirigidas a quien tiene la sesión abierta. */
export async function listTherapistRequests(): Promise<TherapistContactRequest[]> {
  const { data, error } = await supabase.rpc("list_received_contact_requests");
  if (error || !data) return [];
  return (data as Record<string, string>[]).map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: r.patient_name ?? "",
    status: r.status as ContactRequestStatus,
    message: r.message ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

/** Una solicitud concreta. `null` si no existe o si quien pregunta no es parte. */
export async function getContactRequest(id: string): Promise<ContactRequest | null> {
  const { data, error } = await supabase.rpc("get_contact_request", { p_id: id });
  if (error || !data) return null;

  const fila = (data as Record<string, string>[])[0];
  if (!fila) return null;
  return {
    id: fila.id,
    patientId: fila.patient_id,
    therapistProfileId: fila.therapist_profile_id,
    status: fila.status as ContactRequestStatus,
    message: fila.message ?? null,
    createdAt: fila.created_at,
    updatedAt: fila.updated_at,
  };
}
