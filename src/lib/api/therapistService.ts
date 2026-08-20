// ============================================================================
// Perfil profesional del terapeuta.
//
// `profiles` es identidad: quién eres, cómo se te contacta, qué plan tienes.
// Esto es lo profesional: qué atiendes, en qué idioma, de qué forma. Separado
// a propósito — no cambian juntos ni los lee la misma gente.
//
// Las reglas de quién puede editar qué NO están aquí: viven en el trigger
// `enforce_therapist_profile_ownership`. Con RLS desactivado, una comprobación
// en el cliente es una sugerencia. Esta capa refleja la regla para que la
// interfaz no ofrezca acciones que el servidor va a rechazar.
// ============================================================================
import { supabase } from "../supabase";
import type { ThemeKey } from "./themes";

export type TherapyModality = "virtual" | "presencial";
export type AgeGroup = "ninos" | "adolescentes" | "adultos" | "adultos_mayores";
export type AvailabilitySlot = "mananas" | "tardes" | "noches" | "fines_de_semana";

export const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  ninos: "Niñas y niños",
  adolescentes: "Adolescentes",
  adultos: "Adultos",
  adultos_mayores: "Adultos mayores",
};

export const AVAILABILITY_LABELS: Record<AvailabilitySlot, string> = {
  mananas: "Mañanas",
  tardes: "Tardes",
  noches: "Noches",
  fines_de_semana: "Fines de semana",
};

export const MODALITY_LABELS: Record<TherapyModality, string> = {
  virtual: "Virtual",
  presencial: "Presencial",
};

export interface TherapistProfileRecord {
  profile_id: string;
  professional_name: string;
  license_number: string | null;
  bio: string | null;
  specializations: ThemeKey[];
  languages: string[];
  modalities: TherapyModality[];
  age_groups: AgeGroup[];
  availability: AvailabilitySlot[];
  /** Derivadas de `modalities` en la base. Nunca se escriben. */
  accepts_online: boolean;
  accepts_in_person: boolean;
  years_experience: number | null;
  /** Credenciales revisadas por el admin. El propio terapeuta no puede ponérselo. */
  verified: boolean;
  active: boolean;
}

/** Lo que un terapeuta puede editar de su propio perfil. `verified` no está, a propósito. */
export type TherapistProfileInput = Partial<
  Omit<
    TherapistProfileRecord,
    "profile_id" | "accepts_online" | "accepts_in_person" | "verified"
  >
> & { professional_name: string };

const CAMPOS =
  "profile_id, professional_name, license_number, bio, specializations, languages, " +
  "modalities, age_groups, availability, accepts_online, accepts_in_person, " +
  "years_experience, verified, active";

/**
 * El perfil profesional de un terapeuta. Sin argumento, el de la sesión actual.
 *
 * Devuelve `null` cuando no existe todavía — es el estado normal de un
 * terapeuta recién creado, no un error.
 */
export async function getTherapistProfile(
  profileId?: string,
): Promise<TherapistProfileRecord | null> {
  let id = profileId;
  if (!id) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    id = session?.user?.id;
  }
  if (!id) return null;

  const { data, error } = await supabase
    .from("therapist_profiles")
    .select(CAMPOS)
    .eq("profile_id", id)
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as TherapistProfileRecord;
}

/**
 * Crea o actualiza el perfil profesional de quien tiene la sesión abierta.
 *
 * Upsert y no update: un terapeuta sin perfil todavía es el caso corriente, y
 * distinguir "crear" de "editar" en la interfaz no aporta nada.
 */
export async function updateTherapistProfile(
  input: TherapistProfileInput,
): Promise<TherapistProfileRecord | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const id = session?.user?.id;
  if (!id) throw new Error("Necesitas iniciar sesión para editar tu perfil profesional.");

  const { data, error } = await supabase
    .from("therapist_profiles")
    .upsert({ ...input, profile_id: id }, { onConflict: "profile_id" })
    .select(CAMPOS)
    .maybeSingle();

  if (error) {
    // El trigger habla en códigos; aquí se traduce a algo que se pueda leer.
    if (error.message.includes("THERAPIST_PROFILE_VERIFIED_ADMIN_ONLY")) {
      throw new Error("La verificación de credenciales la realiza el equipo administrador.");
    }
    if (error.message.includes("THERAPIST_PROFILE_FORBIDDEN")) {
      throw new Error("Solo puedes editar tu propio perfil profesional.");
    }
    throw new Error("No se pudo guardar el perfil profesional.");
  }
  return (data as unknown as TherapistProfileRecord) ?? null;
}

/**
 * Perfiles profesionales activos, para el directorio y el matching.
 *
 * Se excluyen los inactivos: dar de baja a un profesional debe sacarlo del
 * directorio sin borrar sus notas ni sus sesiones.
 */
export async function listTherapists(): Promise<TherapistProfileRecord[]> {
  const { data, error } = await supabase
    .from("therapist_profiles")
    .select(CAMPOS)
    .eq("active", true);

  if (error || !data) return [];
  return data as unknown as TherapistProfileRecord[];
}
