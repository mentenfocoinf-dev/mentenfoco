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
export async function getHighPriorityAlerts(patientIds: string[]) {
  if (patientIds.length === 0) return [];
  const { data } = await supabase
    .from("clinical_alerts")
    .select("id, patient_id, status, created_at")
    .eq("status", "high_priority")
    .in("patient_id", patientIds)
    .order("created_at", { ascending: false });
  return data ?? [];
}
