// ============================================================================
// Solicitudes de servicios adicionales del paciente.
//
// La solicitud se registra en `service_requests` aunque todavía no exista
// pasarela de pago: primero queda la constancia y el equipo clínico contacta al
// paciente. El cobro se conecta en una fase posterior.
// ============================================================================
import { supabase } from "../supabase";

export type ServiceType =
  | "additional_consultation"
  | "neuropsych_assessment"
  | "psychometric_testing";

export interface ServiceOption {
  type: ServiceType;
  title: string;
  description: string;
}

export const SERVICE_OPTIONS: ServiceOption[] = [
  {
    type: "additional_consultation",
    title: "Consulta adicional",
    description: "Una sesión extra por fuera de las incluidas en tu plan.",
  },
  {
    type: "neuropsych_assessment",
    title: "Valoración neuropsicológica",
    description: "Evaluación en profundidad de memoria, atención y funciones ejecutivas.",
  },
  {
    type: "psychometric_testing",
    title: "Aplicación de pruebas",
    description: "Aplicación y lectura de pruebas psicométricas por un profesional.",
  },
];

export const SERVICE_LABELS: Record<ServiceType, string> = SERVICE_OPTIONS.reduce(
  (acc, opt) => ({ ...acc, [opt.type]: opt.title }),
  {} as Record<ServiceType, string>,
);

export interface ServiceRequest {
  id: string;
  patient_id: string;
  service_type: ServiceType;
  notes: string | null;
  status: string;
  created_at: string;
}

export async function createServiceRequest(params: {
  patientId: string;
  serviceType: ServiceType;
  notes?: string;
}) {
  const { error } = await supabase.from("service_requests").insert({
    patient_id: params.patientId,
    service_type: params.serviceType,
    notes: params.notes?.trim() || null,
  });
  if (error) throw new Error(error.message);
}

/** Solicitudes del paciente, de la más reciente a la más antigua. */
export async function getPatientServiceRequests(patientId: string) {
  const { data } = await supabase
    .from("service_requests")
    .select("id, patient_id, service_type, notes, status, created_at")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });
  return (data ?? []) as ServiceRequest[];
}
