// ============================================================================
// Datos agregados de la ficha de paciente (vista del terapeuta).
//
// Reúne en un solo lugar lo que la ficha necesita: uso del plan, documentos
// clínicos por tipo, y el estado de las alertas de crisis. Los datos crudos ya
// viven en clinicalService/sessionsService; aquí solo se combinan.
// ============================================================================
import { supabase, type PlanType, type Profile } from "../supabase";
import { PLAN_SESSION_QUOTA } from "./plans";

// ── Documentos clínicos ─────────────────────────────────────────────────────

export type DocumentType = "valoracion" | "informe" | "evolucion";

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  valoracion: "Valoración",
  informe: "Informe",
  evolucion: "Evolución",
};

/** Clases de color por tipo, para el badge de la lista de documentos. */
export const DOCUMENT_BADGE_CLASSES: Record<DocumentType, string> = {
  valoracion: "bg-violet-50 text-violet-700 border-violet-200",
  informe: "bg-amber-50 text-amber-700 border-amber-200",
  evolucion: "bg-sky-50 text-sky-700 border-sky-200",
};

export interface TreatmentPlan {
  objetivos: string[];
  modalidad: string;
  frecuencia_sugerida: string;
  pronostico: string;
}

/** Contenido de soap_data en una evolución: deliberadamente más corto que una
 *  valoración, para que registrar una sesión no cueste el formulario completo. */
export interface EvolucionData {
  orientacion: string;
  presentacion: string;
  estado_animo: string;
  resumen: string;
  plan_proxima_sesion: string;
  adherencia_tareas?: "cumplida" | "parcial" | "no_cumplida";
}

export interface InformeData {
  resumen_valoracion: string;
  resumen_evolucion: string;
  diagnostic: string;
  conclusiones: string;
  recomendaciones: string;
  evaluaciones_referenciadas: string[];
}

export interface ClinicalDocument {
  id: string;
  patient_id: string;
  therapist_id: string;
  document_type: DocumentType;
  session_id: string | null;
  soap_data: Record<string, unknown> | null;
  treatment_plan: TreatmentPlan | null;
  is_signed: boolean;
  signed_at: string | null;
  created_at: string;
}

export async function getPatientDocuments(patientId: string): Promise<ClinicalDocument[]> {
  const { data, error } = await supabase
    .from("clinical_notes")
    .select(
      "id, patient_id, therapist_id, document_type, session_id, soap_data, treatment_plan, is_signed, signed_at, created_at",
    )
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[patientOverview] Error cargando documentos:", error.message);
    return [];
  }
  return (data ?? []) as ClinicalDocument[];
}

/** Última valoración firmada: base del encabezado y del borrador de informe. */
export function latestSignedValoracion(docs: ClinicalDocument[]): ClinicalDocument | null {
  return docs.find((d) => d.document_type === "valoracion" && d.is_signed) ?? null;
}

// ── Uso del plan ────────────────────────────────────────────────────────────

export interface PlanUsage {
  plan: PlanType;
  /** null cuando el plan no incluye sesiones (free). */
  quota: number | null;
  used: number;
  /** Etiqueta del mes calendario que se está contando, p. ej. "julio de 2026". */
  periodLabel: string;
}

/**
 * Sesiones completadas en el mes calendario en curso frente al cupo del plan.
 *
 * Se cuentan solo las de status 'completada': una sesión programada todavía
 * puede cancelarse, así que descontarla del cupo antes de que ocurra daría un
 * número que luego habría que devolver.
 */
export async function getPatientPlanUsage(
  patientId: string,
  plan: PlanType,
): Promise<PlanUsage> {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const { count } = await supabase
    .from("therapy_sessions")
    .select("id", { count: "exact", head: true })
    .eq("patient_id", patientId)
    .eq("status", "completada")
    .gte("scheduled_at", from.toISOString())
    .lt("scheduled_at", to.toISOString());

  return {
    plan,
    quota: PLAN_SESSION_QUOTA[plan] ?? null,
    used: count ?? 0,
    periodLabel: from.toLocaleDateString("es-CO", { month: "long", year: "numeric" }),
  };
}

// ── Perfil del paciente para el encabezado ──────────────────────────────────

export async function getPatientProfile(patientId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", patientId)
    .maybeSingle();
  return (data as Profile) ?? null;
}

// ── Alertas de crisis del paciente (todas, con su resolución) ───────────────

export interface PatientAlert {
  id: string;
  created_at: string;
  resolved_at: string | null;
  resolution_action: string | null;
  resolution_notes: string | null;
  resolved_by: string | null;
}

export async function getPatientAlerts(patientId: string): Promise<PatientAlert[]> {
  const { data } = await supabase
    .from("clinical_alerts")
    .select("id, created_at, resolved_at, resolution_action, resolution_notes, resolved_by")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });
  return (data ?? []) as PatientAlert[];
}

// ── Escritura de documentos ─────────────────────────────────────────────────

export async function saveClinicalDocument(params: {
  documentId: string | null;
  patientId: string;
  therapistId: string;
  documentType: DocumentType;
  soapData: Record<string, unknown>;
  treatmentPlan?: TreatmentPlan | null;
  sessionId?: string | null;
  sign: boolean;
}) {
  const payload = {
    patient_id: params.patientId,
    therapist_id: params.therapistId,
    document_type: params.documentType,
    soap_data: params.soapData,
    treatment_plan: params.treatmentPlan ?? null,
    session_id: params.sessionId ?? null,
    is_signed: params.sign,
    signed_at: params.sign ? new Date().toISOString() : null,
  };

  const query = params.documentId
    ? supabase.from("clinical_notes").update(payload).eq("id", params.documentId)
    : supabase.from("clinical_notes").insert(payload);

  const { error } = await query;
  if (error) {
    // El trigger tr_check_clinical_note_immutability rechaza editar una nota ya
    // firmada. Se traduce a lenguaje entendible en vez de mostrar el error crudo.
    if (error.message.includes("INMUTABILIDAD_CLINICA")) {
      throw new Error(
        "Este documento ya está firmado y no puede modificarse. Crea uno nuevo si necesitas corregirlo.",
      );
    }
    throw new Error(error.message);
  }
}
