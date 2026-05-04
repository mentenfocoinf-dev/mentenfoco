import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// No lanza error en SSR — el cliente se inicializa con placeholders seguros
// si las vars aún no están inyectadas por Vite. Las peticiones reales solo
// ocurren en el cliente donde import.meta.env ya está disponible.
const supabaseUrl  = (import.meta.env.VITE_SUPABASE_URL  as string) || "https://placeholder.supabase.co";
const supabaseKey  = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "placeholder";

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
  created_at: string;
  updated_at: string;
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
  id: string;
  patient_id: string;
  therapist_id: string;
  status: string;
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
