// ============================================================================
// La relación formal paciente ↔ terapeuta.
//
// Cinco funciones y ninguna más. La relación NO se crea desde aquí: nace sola
// cuando una solicitud pasa a aceptada, en el trigger
// `create_relationship_on_accept`. Aceptar y quedar asignado tienen que ser el
// mismo hecho — si lo hiciera el cliente, una pestaña cerrada a destiempo
// dejaría solicitudes aceptadas sin relación y nadie lo notaría hasta que un
// paciente preguntara por qué no tiene terapeuta.
//
// Quién puede cerrar una relación y qué transiciones existen también viven en
// la base. Aquí solo se pide el cambio y se traduce el error.
//
// La lectura va por función `SECURITY DEFINER` que filtra por `auth.uid()`:
// paciente ve la suya, terapeuta las suyas, admin todas.
// ============================================================================
import { supabase } from "../supabase";
import { trackEvent } from "./journeyService";
import type { ThemeKey } from "./themes";

export type RelationshipStatus = "active" | "finished" | "cancelled";

export const RELATIONSHIP_STATUS_LABELS: Record<RelationshipStatus, string> = {
  active: "Activa",
  finished: "Finalizada",
  cancelled: "Cancelada",
};

/** La relación vista por el paciente: al otro lado hay un profesional. */
export interface MyTherapist {
  id: string;
  therapistProfileId: string;
  therapistName: string;
  specializations: ThemeKey[];
  status: RelationshipStatus;
  assignedAt: string;
  endedAt: string | null;
}

/** La relación vista por el terapeuta: al otro lado hay un paciente. */
export interface MyPatient {
  id: string;
  patientId: string;
  patientName: string;
  status: RelationshipStatus;
  assignedAt: string;
  endedAt: string | null;
}

export interface Relationship {
  id: string;
  patientId: string;
  therapistProfileId: string;
  contactRequestId: string | null;
  status: RelationshipStatus;
  assignedAt: string;
  endedAt: string | null;
}

const MENSAJES_DE_ERROR: [string, string][] = [
  ["RELATIONSHIP_APPEND_ONLY", "Una relación no se borra: se finaliza o se cancela."],
  ["RELATIONSHIP_CLOSED", "Esta relación ya está cerrada."],
  ["RELATIONSHIP_IMMUTABLE", "Quién, con quién y desde cuándo no se pueden cambiar."],
  ["RELATIONSHIP_INVALID_TRANSITION", "Desde activa solo se puede finalizar o cancelar."],
  ["RELATIONSHIP_FORBIDDEN", "Esta relación no es tuya."],
];

function traducir(mensaje: string): Error {
  const encontrado = MENSAJES_DE_ERROR.find(([codigo]) => mensaje.includes(codigo));
  return new Error(encontrado ? encontrado[1] : "No se pudo actualizar la relación.");
}

/** Único punto de cierre. Las dos transiciones comparten camino. */
async function cerrar(id: string, status: Exclude<RelationshipStatus, "active">): Promise<void> {
  const { error } = await supabase.from("patient_therapist").update({ status }).eq("id", id);
  if (error) throw traducir(error.message);
}

// ── Lectura ─────────────────────────────────────────────────────────────────

/** El terapeuta asignado a quien tiene la sesión abierta. `null` si no tiene. */
export async function getMyTherapist(): Promise<MyTherapist | null> {
  const { data, error } = await supabase.rpc("get_my_therapist");
  if (error || !data) return null;

  const fila = (data as Record<string, unknown>[])[0];
  if (!fila) return null;
  return {
    id: String(fila.id),
    therapistProfileId: String(fila.therapist_profile_id),
    therapistName: (fila.therapist_name as string) ?? "",
    specializations: Array.isArray(fila.specializations)
      ? (fila.specializations as ThemeKey[])
      : [],
    status: fila.status as RelationshipStatus,
    assignedAt: String(fila.assigned_at),
    endedAt: (fila.ended_at as string) ?? null,
  };
}

/** Los pacientes de quien tiene la sesión abierta. Vacío si no es terapeuta. */
export async function getMyPatients(): Promise<MyPatient[]> {
  const { data, error } = await supabase.rpc("get_my_patients");
  if (error || !data) return [];

  return (data as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    patientId: String(r.patient_id),
    patientName: (r.patient_name as string) ?? "",
    status: r.status as RelationshipStatus,
    assignedAt: String(r.assigned_at),
    endedAt: (r.ended_at as string) ?? null,
  }));
}

/** Una relación concreta. `null` si no existe o si quien pregunta no es parte. */
export async function getRelationship(id: string): Promise<Relationship | null> {
  const { data, error } = await supabase.rpc("get_relationship", { p_id: id });
  if (error || !data) return null;

  const fila = (data as Record<string, unknown>[])[0];
  if (!fila) return null;
  return {
    id: String(fila.id),
    patientId: String(fila.patient_id),
    therapistProfileId: String(fila.therapist_profile_id),
    contactRequestId: (fila.contact_request_id as string) ?? null,
    status: fila.status as RelationshipStatus,
    assignedAt: String(fila.assigned_at),
    endedAt: (fila.ended_at as string) ?? null,
  };
}

// ── Cierre ──────────────────────────────────────────────────────────────────

/** El proceso llegó a su fin. Distinto de cancelar: esto es haber terminado. */
export async function finishRelationship(id: string): Promise<void> {
  await cerrar(id, "finished");
  trackEvent("THERAPIST_RELATIONSHIP_FINISHED", { resource_id: id, resource_type: "relacion" });
}

/** El proceso se interrumpe antes de terminar. */
export async function cancelRelationship(id: string): Promise<void> {
  await cerrar(id, "cancelled");
  trackEvent("THERAPIST_RELATIONSHIP_CANCELLED", { resource_id: id, resource_type: "relacion" });
}
