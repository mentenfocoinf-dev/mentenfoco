// ============================================================================
// Consentimiento informado clínico (Ley 1090/2006).
//
// No confundir con el consentimiento de datos (Ley 1581), que vive en
// profiles.terms_accepted_at. Este consiente el PROCESO de atención y por eso se
// pide justo antes de la anamnesis: no se entrega la historia clínica sin haber
// consentido el proceso al que pertenece.
//
// La barrera de integridad NO está aquí: los triggers
// enforce_clinical_consent_immutability y _no_delete impiden reescribir o borrar
// el registro. Esta capa decide a QUIÉN se le pide y qué se muestra.
// ============================================================================
import { supabase, type Profile } from "../supabase";
import { CLINICAL_CONSENT_VERSION } from "../../components/ClinicalConsentText";

export interface ClinicalConsent {
  id: string;
  patient_id: string;
  version: number;
  accepted_at: string;
  revoked_at: string | null;
  created_at: string;
}

export type ClinicalConsentState =
  /** No aplica: staff, o paciente que aún no inició proceso clínico. */
  | { estado: "no_aplica" }
  /** En proceso clínico y sin consentimiento de la versión vigente. */
  | { estado: "pendiente" }
  | { estado: "aceptado"; consent: ClinicalConsent }
  | { estado: "revocado"; consent: ClinicalConsent };

/**
 * ¿Este paciente está en un proceso clínico?
 *
 * Es la misma población que hace anamnesis, pero NO se puede usar
 * `onboarding_completed === false` para detectarla: ese campo se pone en true al
 * terminar la anamnesis, y entonces un paciente que revoque —o al que le suba la
 * versión del texto— dejaría de tener el consentimiento exigido justo cuando más
 * hace falta. La señal correcta es la que define el proceso: tiene plan de pago
 * o tiene terapeuta asignado.
 *
 * Las cuentas gratuitas de captación no cumplen ninguna de las dos, así que no
 * quedan atascadas en este paso mientras solo consuman contenido.
 */
export async function isInClinicalProcess(profile: Profile): Promise<boolean> {
  if (profile.role !== "patient") return false;
  if (profile.plan_type && profile.plan_type !== "free") return true;

  // Por función: el propio paciente pregunta por su terapeuta asignado.
  const { data } = await supabase.rpc("get_assigned_therapist");

  return Boolean(data);
}

/** Fila del consentimiento de la versión vigente, si existe. */
export async function getCurrentConsent(patientId: string): Promise<ClinicalConsent | null> {
  const { data, error } = await supabase
    .from("clinical_consents")
    .select("*")
    .eq("patient_id", patientId)
    .eq("version", CLINICAL_CONSENT_VERSION)
    .maybeSingle();

  if (error) {
    console.error("[clinicalConsent] Error leyendo el consentimiento:", error.message);
    return null;
  }
  return (data as ClinicalConsent) ?? null;
}

/**
 * Estado del consentimiento para mostrar y para decidir el gate.
 *
 * `checkProcess = false` lo usan el terapeuta y el admin al abrir la ficha: ahí
 * ya se sabe que es un paciente en proceso y sobra la consulta extra.
 */
export async function getClinicalConsentState(
  profile: Profile,
  checkProcess = true,
): Promise<ClinicalConsentState> {
  if (profile.role !== "patient") return { estado: "no_aplica" };
  if (checkProcess && !(await isInClinicalProcess(profile))) return { estado: "no_aplica" };

  const consent = await getCurrentConsent(profile.id);
  if (!consent) return { estado: "pendiente" };
  if (consent.revoked_at) return { estado: "revocado", consent };
  return { estado: "aceptado", consent };
}

/** Igual que el anterior pero por id, para la ficha del paciente. */
export async function getClinicalConsentStateById(
  patientId: string,
): Promise<ClinicalConsentState> {
  const consent = await getCurrentConsent(patientId);
  if (!consent) return { estado: "pendiente" };
  if (consent.revoked_at) return { estado: "revocado", consent };
  return { estado: "aceptado", consent };
}

/**
 * Registra la aceptación de la versión vigente.
 *
 * Hace upsert sobre (patient_id, version) porque un paciente que revocó y vuelve
 * a aceptar debe reactivar SU fila, no crear una segunda: dos filas de la misma
 * versión harían ambiguo cuál es el consentimiento actual. El índice único lo
 * garantiza; aquí solo se le da el camino correcto.
 */
export async function acceptClinicalConsent(patientId: string): Promise<void> {
  const ahora = new Date().toISOString();

  const existente = await getCurrentConsent(patientId);
  if (existente) {
    const { error } = await supabase
      .from("clinical_consents")
      .update({ revoked_at: null, accepted_at: ahora })
      .eq("id", existente.id);
    if (error) throw new Error(traducirError(error.message));
    return;
  }

  const { error } = await supabase
    .from("clinical_consents")
    .insert({ patient_id: patientId, version: CLINICAL_CONSENT_VERSION, accepted_at: ahora });
  if (error) throw new Error(traducirError(error.message));
}

/**
 * Revoca el consentimiento vigente. No borra la fila: el registro de que hubo
 * consentimiento es parte de la historia del proceso.
 */
export async function revokeClinicalConsent(patientId: string): Promise<void> {
  const existente = await getCurrentConsent(patientId);
  if (!existente) throw new Error("No hay un consentimiento vigente que revocar.");
  if (existente.revoked_at) return; // ya estaba revocado

  const { error } = await supabase
    .from("clinical_consents")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", existente.id);
  if (error) throw new Error(traducirError(error.message));
}

function traducirError(mensaje: string): string {
  if (mensaje.includes("CLINICAL_CONSENT_IMMUTABLE"))
    return "Este registro de consentimiento no se puede modificar.";
  if (mensaje.includes("CLINICAL_CONSENT_NO_DELETE"))
    return "Un consentimiento no se elimina; se revoca.";
  return mensaje;
}

/** Fecha larga en español para mostrar en la ficha y en ajustes. */
export function formatConsentDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
