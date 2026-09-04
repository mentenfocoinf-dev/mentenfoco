// ============================================================================
// Citas de una relación terapéutica.
//
// Ocho funciones y ninguna más. Ninguna regla vive aquí: quién puede pedir,
// confirmar, cancelar o completar —y qué transiciones existen— lo impone el
// trigger `enforce_appointment_rules`. Los solapamientos los impide una
// restricción EXCLUDE de Postgres, no una consulta previa: un `SELECT` seguido
// de un `INSERT` deja una ventana por la que se cuela la cita del medio.
//
// `patient_id` y `therapist_id` no se envían nunca: los deriva la base desde la
// relación. Lo único que viaja es cuándo y con qué relación.
// ============================================================================
import { supabase } from "../supabase";
import { track } from "../analytics";

export type AppointmentStatus =
  | "requested"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no_show";

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  requested: "Solicitada",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Realizada",
  no_show: "No asistió",
};

export interface Appointment {
  id: string;
  relationshipId: string;
  /** Nombre de la otra parte: profesional para el paciente y al revés. */
  counterpartName: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  notes: string | null;
  createdBy: string;
  /**
   * La solicitud que esta cita vino a sustituir, si es una contraoferta.
   *
   * Las horas son inmutables, así que proponer otro horario no edita la cita:
   * cancela la original y crea otra enlazada. El historial queda entero y esta
   * columna es el hilo que lo cose.
   */
  replacesAppointmentId: string | null;
}

const MENSAJES_DE_ERROR: [string, string][] = [
  ["APPOINTMENT_APPEND_ONLY", "Una cita no se borra: se cancela."],
  ["APPOINTMENT_CLOSED", "Esta cita ya está cerrada."],
  ["APPOINTMENT_IMMUTABLE", "Para cambiar la hora hay que cancelar y pedir otra."],
  ["APPOINTMENT_PATIENT_CAN_ONLY_CANCEL", "Solo puedes cancelar tu cita."],
  ["APPOINTMENT_INVALID_TRANSITION", "Esa transición no está permitida."],
  ["APPOINTMENT_RELATIONSHIP_INACTIVE", "No tienes un proceso activo con este profesional."],
  ["APPOINTMENT_NO_RELATIONSHIP", "Esa relación no existe."],
  ["APPOINTMENT_IN_THE_PAST", "No se puede agendar una cita hacia atrás."],
  ["APPOINTMENT_SLOT_UNAVAILABLE", "El profesional no atiende en esa franja horaria."],
  ["APPOINTMENT_MODALITY_MISMATCH", "No coincide la modalidad de atención."],
  ["APPOINTMENT_FORBIDDEN", "Esta cita no es tuya."],
  ["APPOINTMENT_CHAIN_NOT_FOUND", "Esa solicitud ya no existe."],
  ["APPOINTMENT_CHAIN_MISMATCH", "Esa solicitud es de otro proceso."],
  ["APPOINTMENT_CHAIN_ORIGIN_ALIVE", "La solicitud original sigue abierta."],
  ["APPOINTMENT_CHAIN_IMMUTABLE", "El enlace con la solicitud anterior no se cambia."],
  ["appointments_una_sola_sustitucion", "Ya propusiste otro horario para esta solicitud."],
  // Solapamiento CRUZADO: la comprobación mira citas y sesiones clínicas.
  ["AGENDA_CONFLICT", "Ese horario ya está ocupado en la agenda."],
  ["appointments_sin_solape_terapeuta", "El profesional ya tiene una cita a esa hora."],
  ["appointments_sin_solape_paciente", "Ya tienes una cita a esa hora."],
  ["appointments_duracion_razonable", "La duración debe estar entre 15 minutos y 4 horas."],
  ["appointments_intervalo_valido", "La hora de fin debe ser posterior a la de inicio."],
];

function traducir(mensaje: string): Error {
  const encontrado = MENSAJES_DE_ERROR.find(([codigo]) => mensaje.includes(codigo));
  return new Error(encontrado ? encontrado[1] : "No se pudo completar la operación.");
}

/** Único punto de cambio de estado. Las tres transiciones comparten camino. */
async function cambiarEstado(id: string, status: AppointmentStatus): Promise<void> {
  const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
  if (error) throw traducir(error.message);
}

function mapear(filas: Record<string, string | null>[]): Appointment[] {
  return filas.map((a) => ({
    id: a.id as string,
    relationshipId: a.relationship_id as string,
    counterpartName: a.counterpart_name ?? "",
    startsAt: a.starts_at as string,
    endsAt: a.ends_at as string,
    status: a.status as AppointmentStatus,
    notes: a.notes,
    createdBy: a.created_by as string,
    replacesAppointmentId: a.replaces_appointment_id ?? null,
  }));
}

// ── Escritura ───────────────────────────────────────────────────────────────

/**
 * Pide una cita dentro de una relación.
 *
 * No recibe paciente ni profesional: salen de la relación, en la base. Nace
 * siempre como solicitada — confirmarla es del profesional.
 */
export async function requestAppointment(
  relationshipId: string,
  startsAt: string,
  endsAt: string,
  notes?: string | null,
): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const quien = session?.user?.id;
  if (!quien) throw new Error("Necesitas iniciar sesión para pedir una cita.");

  const { error } = await supabase.from("appointments").insert({
    relationship_id: relationshipId,
    starts_at: startsAt,
    ends_at: endsAt,
    created_by: quien,
    notes: notes?.trim() ? notes.trim().slice(0, 1000) : null,
  });
  if (error) throw traducir(error.message);
  track("sesion_reservada");
}

/**
 * Contraoferta: propone otro horario para una solicitud.
 *
 * No edita la cita —las horas son inmutables por trigger—: cancela la original
 * y crea otra enlazada a ella. Las dos cosas pasan dentro de la MISMA
 * transacción, en la base; hacerlo con dos llamadas desde aquí dejaría al
 * paciente sin cita y sin propuesta si la segunda fallara.
 *
 * Devuelve el id de la nueva solicitud.
 */
export async function proposeNewTime(
  appointmentId: string,
  startsAt: string,
  endsAt: string,
  message?: string | null,
): Promise<string> {
  const { data, error } = await supabase.rpc("propose_new_time", {
    p_appointment_id: appointmentId,
    p_starts_at: startsAt,
    p_ends_at: endsAt,
    p_message: message?.trim() ? message.trim().slice(0, 1000) : null,
  });
  if (error) throw traducir(error.message);
  return data as string;
}

export async function confirmAppointment(id: string): Promise<void> {
  await cambiarEstado(id, "confirmed");
}

export async function cancelAppointment(id: string): Promise<void> {
  await cambiarEstado(id, "cancelled");
}

export async function completeAppointment(id: string): Promise<void> {
  await cambiarEstado(id, "completed");
}

// ── Lectura ─────────────────────────────────────────────────────────────────

/** Las citas de quien tiene la sesión abierta, como paciente. */
export async function listMyAppointments(): Promise<Appointment[]> {
  const { data, error } = await supabase.rpc("list_my_appointments");
  if (error || !data) return [];
  return mapear(data as Record<string, string | null>[]);
}

/** Las citas de quien tiene la sesión abierta, como profesional. */
export async function listTherapistAppointments(): Promise<Appointment[]> {
  const { data, error } = await supabase.rpc("list_therapist_appointments");
  if (error || !data) return [];
  return mapear(data as Record<string, string | null>[]);
}

/**
 * Horas libres de un día para una relación, en la hora local de quien pregunta.
 *
 * Las calcula la base cruzando sesiones clínicas, citas vivas y la franja que
 * el profesional declaró — la misma comprobación que impide el solapamiento al
 * insertar. Así el selector no ofrece nada que el servidor vaya a rechazar.
 *
 * La ventana se resuelve AQUÍ, no en la base: el servidor corre en UTC y no
 * tiene forma de saber en qué huso vive el paciente, así que preguntarle "de 7
 * a 19" devolvía de 02:00 a 14:00 hora de Colombia. El navegador sí lo sabe.
 *
 * `dia` es `YYYY-MM-DD` en hora local. Devuelve instantes ISO.
 *
 * No revela QUÉ ocupa las horas tomadas: solo cuáles quedan.
 */
export async function listAvailableHours(
  relationshipId: string,
  dia: string,
  desdeHora = 7,
  hastaHora = 19,
): Promise<string[]> {
  const [a, m, d] = dia.split("-").map(Number);
  if (!a || !m || !d) return [];

  const desde = new Date(a, m - 1, d, desdeHora, 0, 0, 0);
  const hasta = new Date(a, m - 1, d, hastaHora, 0, 0, 0);

  const { data, error } = await supabase.rpc("available_hours", {
    p_relationship_id: relationshipId,
    p_desde_instante: desde.toISOString(),
    p_hasta_instante: hasta.toISOString(),
  });
  if (error || !data) return [];
  return (data as { hora: string }[]).map((h) => h.hora).filter(Boolean);
}
