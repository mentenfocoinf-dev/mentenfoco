import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// No lanza error en SSR — el cliente se inicializa con placeholders seguros
// si las vars aún no están inyectadas por Vite. Las peticiones reales solo
// ocurren en el cliente donde import.meta.env ya está disponible.
const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string) || "https://placeholder.supabase.co";
const supabaseKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "placeholder";

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// ── Tipos derivados del schema ─────────────────────────────────────────
export type UserRole = "admin" | "therapist" | "patient";
export type PlanType = "free" | "esencial" | "integral" | "premium";
export type LeadStatus = "new" | "contacted" | "closed_won" | "closed_lost";
export type GuideStatus = "saved" | "completed";
export type TaskStatus = "pending" | "done";

export interface Profile {
  id: string;
  role: UserRole;
  plan_type: PlanType;
  stripe_customer_id: string | null;
  subscription_status: string;
  full_name: string | null;
  avatar_url: string | null;
  email?: string | null;
  professional_card?: string | null;
  session_token?: string | null;
  onboarding_completed?: boolean;
  // Campos del signup autoservicio de cuenta gratuita (20260720_signup_gratis.sql)
  phone?: string | null;
  must_change_password?: boolean;
  terms_accepted_at?: string | null;
  terms_version?: string | null;
  marketing_consent?: boolean;
  signup_source?: string | null;
  // Datos mínimos de operación (20260721_profile_completion_fields.sql)
  cedula?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * @deprecated Sustituido por `trackEvent()` de `lib/api/journeyService.ts` (30-jul).
 *
 * Escribe en `telemetry_events`, una tabla de 5 columnas que ningún módulo llega
 * a usar. El Journey Engine la reemplaza con `journey_events`: catálogo cerrado
 * de eventos, identidad anónima, UTM y escritura que no puede bloquear la
 * navegación. Se conserva para no romper una llamada futura, no para usarse.
 */
export async function trackTelemetryEvent(eventType: string, payload: any = {}) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("telemetry_events").insert({
      user_id: user?.id || null,
      event_type: eventType,
      payload,
    });
  } catch (err) {
    console.error("Error tracking telemetry:", err);
  }
}

export interface CrmLead {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  interest?: string;
  status?: LeadStatus;
  created_at?: string;
}

export interface PatientTherapist {
  patient_id: string;
  therapist_id: string;
  created_at: string;
  // Join para obtener datos del paciente
  patient?: Profile;
}

export interface ClinicalRecommendation {
  id: string;
  patient_id: string;
  therapist_id: string;
  title: string;
  description: string;
  frequency: string;
  created_at: string;
}
