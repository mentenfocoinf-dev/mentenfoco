// Anamnesis y evaluaciones psicométricas — subset del lado paciente de
// src/lib/api/clinicalService.ts.
import { supabase } from "../supabase";

export interface PsychometricEvaluation {
  scale_type: string;
  total_score: number;
  severity_level: string | null;
  evaluated_at: string;
}

export async function getPatientEvaluations(patientId: string): Promise<PsychometricEvaluation[]> {
  const { data } = await supabase
    .from("psychometric_evaluations")
    .select("scale_type, total_score, severity_level, evaluated_at")
    .eq("patient_id", patientId)
    .order("evaluated_at", { ascending: false });
  return (data ?? []) as PsychometricEvaluation[];
}

export async function getLatestEvaluationsByScale(
  patientId: string,
): Promise<Record<string, PsychometricEvaluation>> {
  const all = await getPatientEvaluations(patientId);
  const latest: Record<string, PsychometricEvaluation> = {};
  for (const ev of all) {
    if (!latest[ev.scale_type]) latest[ev.scale_type] = ev;
  }
  return latest;
}

// Columnas verificadas contra supabase/20240514_b2b_clinical_prescriptions.sql: scale_type,
// total_score, severity_level, raw_answers (jsonb), evaluated_at.
export async function submitEvaluation(params: {
  patientId: string;
  scaleType: string;
  totalScore: number;
  severityLevel: string;
  rawAnswers: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.from("psychometric_evaluations").insert({
    patient_id: params.patientId,
    scale_type: params.scaleType,
    total_score: params.totalScore,
    severity_level: params.severityLevel,
    raw_answers: params.rawAnswers,
    evaluated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

// Si el riesgo lo amerita (ver psychometricScales.ts), se crea la alerta de crisis — el mismo
// patrón que ya usan CssrsModal.tsx y PsychometricScaleModal.tsx en la web.
export async function createCrisisAlert(patientId: string): Promise<void> {
  const { error } = await supabase.from("clinical_alerts").insert({
    patient_id: patientId,
    status: "high_priority",
  });
  if (error) throw new Error(error.message);
}

export interface AnamnesisSummary {
  data: Record<string, any>;
  audit_c_score: number | null;
  completed_at: string | null;
}

export async function getPatientAnamnesis(patientId: string): Promise<AnamnesisSummary | null> {
  const { data } = await supabase
    .from("patient_anamnesis")
    .select("data, audit_c_score, completed_at")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as AnamnesisSummary | null;
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
