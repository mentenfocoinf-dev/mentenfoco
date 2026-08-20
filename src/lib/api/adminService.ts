// ============================================================================
// Servicio de administración. Toda la lógica vive en el backend:
// - Lecturas y escrituras pasan por RPCs de Postgres (SECURITY DEFINER).
// - La creación de cuentas pasa por la Edge Function admin-create-user.
// El frontend solo llama funciones de este módulo.
// ============================================================================
import { supabase, type PlanType, type UserRole } from "../supabase";

export interface DirectoryTherapist {
  id: string;
  full_name: string | null;
  email: string | null;
  subscription_status: string | null;
  patient_count: number;
}

export interface DirectoryPatient {
  id: string;
  full_name: string | null;
  email: string | null;
  plan_type: PlanType;
  subscription_status: string | null;
  updated_at: string | null;
  therapist_id: string | null;
  therapist_name: string | null;
}

export interface AdminDirectory {
  therapists: DirectoryTherapist[];
  patients: DirectoryPatient[];
}

/** Directorio completo (pacientes + terapeutas + asignaciones) en una llamada. */
export async function getAdminDirectory(): Promise<AdminDirectory> {
  const { data, error } = await supabase.rpc("admin_get_directory");
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No autorizado");
  return data as AdminDirectory;
}

/** Asigna (o reasigna) un paciente a un terapeuta. */
export async function assignPatientToTherapist(patientId: string, therapistId: string) {
  const { error } = await supabase.rpc("admin_assign_patient", {
    p_patient: patientId,
    p_therapist: therapistId,
  });
  if (error) throw new Error(error.message);
}

/** Quita la asignación actual de un paciente. */
export async function unassignPatient(patientId: string) {
  const { error } = await supabase.rpc("admin_unassign_patient", { p_patient: patientId });
  if (error) throw new Error(error.message);
}

/** Cambia el plan y el estado de suscripción de un usuario. */
export async function setUserPlan(userId: string, plan: PlanType, status = "active") {
  const { error } = await supabase.rpc("admin_set_plan", {
    p_user: userId,
    p_plan: plan,
    p_status: status,
  });
  if (error) throw new Error(error.message);
}

/**
 * Activa o desactiva una cuenta (sin tocar su plan).
 *
 * Por función y no por UPDATE directo: `subscription_status` dejó de ser una
 * columna escribible desde el cliente. Con la columna abierta, cualquier
 * usuario podía activarse la suscripción a sí mismo —comprobado—. La función
 * comprueba que quien llama sea administrador, igual que `admin_set_plan`.
 */
export async function setUserStatus(userId: string, status: "active" | "inactive") {
  const { error } = await supabase.rpc("admin_set_status", {
    p_user: userId,
    p_status: status,
  });
  if (error) throw new Error(error.message);
}

export interface CreateUserInput {
  email: string;
  password: string;
  full_name: string;
  role: Extract<UserRole, "patient" | "therapist">;
  plan_type?: PlanType;
}

/** Crea una cuenta nueva (paciente o terapeuta) vía Edge Function. */
export async function createUser(input: CreateUserInput): Promise<{ user_id: string }> {
  const { data, error } = await supabase.functions.invoke("admin-create-user", {
    body: input,
  });
  if (error) {
    // La Edge Function devuelve el detalle del error en el cuerpo
    let detail = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx) {
        const body = await ctx.json();
        if (body?.error) detail = body.error;
      }
    } catch {
      // usamos el mensaje genérico
    }
    throw new Error(detail);
  }
  if (data?.error) throw new Error(data.error);
  return data as { user_id: string };
}
