// ============================================================================
// Servicio clínico: notas SOAP, CIE-11, evaluaciones psicométricas,
// prescripciones, alertas de crisis y anamnesis.
// ============================================================================
import { supabase } from "../supabase";

// ── Notas clínicas (informe del terapeuta) ──────────────────────────────────
export interface SoapData {
  s: string;
  o: string;
  a: string;
  p: string;
  complaints?: string[];
  diagnostic?: string;
  mental_exam?: Record<string, string>;
}

export interface ClinicalNote {
  id: string;
  therapist_id: string;
  patient_id: string;
  soap_data: SoapData | null;
  is_signed: boolean;
  signed_at: string | null;
  created_at: string;
}

export async function getLatestNote(patientId: string, therapistId: string) {
  const { data } = await supabase
    .from("clinical_notes")
    .select("*")
    .eq("patient_id", patientId)
    .eq("therapist_id", therapistId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as ClinicalNote | null;
}

export async function getSignedNotesHistory(patientId: string, therapistId: string) {
  const { data } = await supabase
    .from("clinical_notes")
    .select("id, soap_data, is_signed, signed_at, created_at")
    .eq("patient_id", patientId)
    .eq("therapist_id", therapistId)
    .eq("is_signed", true)
    .order("created_at", { ascending: false })
    .limit(10);
  return (data ?? []) as ClinicalNote[];
}

export async function saveClinicalNote(params: {
  noteId: string | null;
  patientId: string;
  therapistId: string;
  soapData: SoapData;
  sign: boolean;
}) {
  const payload = {
    patient_id: params.patientId,
    therapist_id: params.therapistId,
    soap_data: params.soapData,
    is_signed: params.sign,
    signed_at: params.sign ? new Date().toISOString() : null,
  };
  const query = params.noteId
    ? supabase.from("clinical_notes").update(payload).eq("id", params.noteId)
    : supabase.from("clinical_notes").insert(payload);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

// ── Perfil del terapeuta ────────────────────────────────────────────────────
export async function getTherapistProfile(therapistId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("full_name, professional_card")
    .eq("id", therapistId)
    .single();
  return data as { full_name: string; professional_card?: string } | null;
}

// ── CIE-11 ──────────────────────────────────────────────────────────────────
export interface Cie11Entry {
  code: string;
  description: string;
  category?: string;
}

export async function searchCie11(term: string): Promise<Cie11Entry[]> {
  const { data } = await supabase
    .from("cie11_directory")
    .select("code, description")
    .or(`code.ilike.%${term}%,description.ilike.%${term}%`)
    .limit(15);
  return data ?? [];
}

export async function getCie11Catalog(): Promise<Record<string, Cie11Entry[]>> {
  const { data } = await supabase.from("cie11_directory").select("*").order("category");
  if (!data) return {};
  return data.reduce((acc: Record<string, Cie11Entry[]>, curr: Cie11Entry) => {
    const cat = curr.category || "Otras condiciones clínicas";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(curr);
    return acc;
  }, {});
}

// ── Evaluaciones psicométricas ──────────────────────────────────────────────
export interface PsychometricEvaluation {
  scale_type: string;
  total_score: number;
  severity_level: string | null;
  evaluated_at: string;
}

export async function getPatientEvaluations(patientId: string) {
  const { data } = await supabase
    .from("psychometric_evaluations")
    .select("scale_type, total_score, severity_level, evaluated_at")
    .eq("patient_id", patientId)
    .order("evaluated_at", { ascending: false });
  return (data ?? []) as PsychometricEvaluation[];
}

/** Última evaluación de cada escala (PHQ-9, GAD-7, C-SSRS, etc.). */
export async function getLatestEvaluationsByScale(patientId: string) {
  const all = await getPatientEvaluations(patientId);
  const latest: Record<string, PsychometricEvaluation> = {};
  for (const ev of all) {
    if (!latest[ev.scale_type]) latest[ev.scale_type] = ev;
  }
  return latest;
}

// ── Límite de evaluaciones del plan gratuito ────────────────────────────────

/** Escalas de bienestar sujetas al límite. C-SSRS queda fuera a propósito:
 *  mide riesgo suicida y debe estar siempre disponible. */
export const LIMITED_SCALES = ["phq9", "gad7"] as const;

const FREE_PLAN_COOLDOWN_DAYS = 30;

export interface EvaluationAvailability {
  /** false cuando el plan gratuito ya usó su evaluación del período. */
  allowed: boolean;
  /** Fecha en la que se libera la siguiente. null si ya está disponible. */
  availableOn: Date | null;
}

/**
 * Calcula si un paciente puede hacer una evaluación de bienestar.
 * Refleja la misma regla del trigger free_plan_evaluation_limit: el servidor
 * sigue siendo la autoridad, esto solo evita ofrecer un botón que va a fallar.
 */
export async function getEvaluationAvailability(
  patientId: string,
  isFreePlan: boolean,
): Promise<EvaluationAvailability> {
  if (!isFreePlan) return { allowed: true, availableOn: null };

  const { data } = await supabase
    .from("psychometric_evaluations")
    .select("evaluated_at")
    .eq("patient_id", patientId)
    .in("scale_type", LIMITED_SCALES)
    .order("evaluated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.evaluated_at) return { allowed: true, availableOn: null };

  const availableOn = new Date(data.evaluated_at);
  availableOn.setDate(availableOn.getDate() + FREE_PLAN_COOLDOWN_DAYS);

  return availableOn > new Date()
    ? { allowed: false, availableOn }
    : { allowed: true, availableOn: null };
}

// ── Anamnesis ───────────────────────────────────────────────────────────────
export async function getPatientAnamnesis(patientId: string) {
  const { data } = await supabase
    .from("patient_anamnesis")
    .select("data, audit_c_score, completed_at")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as {
    data: Record<string, unknown>;
    audit_c_score: number | null;
    completed_at: string | null;
  } | null;
}

// ── Prescripciones (tareas de intervención) ─────────────────────────────────
export async function getPrescriptionsCatalog() {
  const { data } = await supabase.from("clinical_prescriptions").select("*").order("titulo");
  return data ?? [];
}

export async function assignPrescriptions(params: {
  patientId: string;
  therapistId: string;
  prescriptionIds: string[];
}) {
  const payload = params.prescriptionIds.map((id) => ({
    patient_id: params.patientId,
    therapist_id: params.therapistId,
    prescription_id: id,
    assigned_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from("patient_prescriptions").insert(payload);
  if (error) throw new Error(error.message);
}

export async function getPatientPrescriptions(patientId: string) {
  const { data } = await supabase
    .from("patient_prescriptions")
    .select(
      `id, assigned_at, completed,
       prescription:clinical_prescriptions (titulo, objetivo_clinico, instruccion_paciente)`,
    )
    .eq("patient_id", patientId)
    .order("assigned_at", { ascending: false });
  return data ?? [];
}

// ── Pacientes del terapeuta ─────────────────────────────────────────────────
export async function getTherapistPatients(therapistId: string) {
  const { data, error } = await supabase
    .from("patient_therapist")
    .select(
      `patient_id, therapist_id, created_at,
       patient:profiles!patient_therapist_patient_id_fkey (
         id, full_name, email, plan_type, subscription_status
       )`,
    )
    .eq("therapist_id", therapistId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── Alertas de crisis ───────────────────────────────────────────────────────

/** Acciones con las que un terapeuta puede cerrar una alerta de crisis. */
export type AlertResolutionAction =
  | "contacted_patient"
  | "session_scheduled"
  | "referred_psychiatry"
  | "emergency_services"
  | "no_action_needed";

export const ALERT_RESOLUTION_LABELS: Record<AlertResolutionAction, string> = {
  contacted_patient: "Contacté al paciente",
  session_scheduled: "Agendé sesión de urgencia",
  referred_psychiatry: "Remití a psiquiatría",
  emergency_services: "Activé servicios de emergencia",
  no_action_needed: "Revisado, no requiere intervención",
};

/** Alertas pendientes (aún sin atender) de los pacientes indicados. */
export async function getHighPriorityAlerts(patientIds: string[]) {
  if (patientIds.length === 0) return [];
  const { data } = await supabase
    .from("clinical_alerts")
    .select("id, patient_id, status, created_at")
    .eq("status", "high_priority")
    .is("resolved_at", null)
    .in("patient_id", patientIds)
    .order("created_at", { ascending: false });
  return data ?? [];
}

/**
 * Registra la atención de una alerta de crisis. No borra ni modifica `status`:
 * la alerta queda en la historia clínica con la gravedad con la que nació y con
 * el rastro de quién la atendió y cómo.
 */
export async function resolveCrisisAlert(params: {
  alertId: string;
  therapistId: string;
  action: AlertResolutionAction;
  notes?: string;
}) {
  const { error } = await supabase
    .from("clinical_alerts")
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by: params.therapistId,
      resolution_action: params.action,
      resolution_notes: params.notes?.trim() || null,
    })
    .eq("id", params.alertId);
  if (error) throw new Error(error.message);
}

export interface ResolvedAlert {
  id: string;
  patient_id: string;
  created_at: string;
  resolved_at: string;
  resolution_action: AlertResolutionAction;
  resolution_notes: string | null;
}

/** Historial de alertas ya atendidas de un paciente (para el informe clínico). */
export async function getResolvedAlerts(patientId: string) {
  const { data } = await supabase
    .from("clinical_alerts")
    .select("id, patient_id, created_at, resolved_at, resolution_action, resolution_notes")
    .eq("patient_id", patientId)
    .not("resolved_at", "is", null)
    .order("resolved_at", { ascending: false });
  return (data ?? []) as ResolvedAlert[];
}
