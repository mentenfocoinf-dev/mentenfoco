// ============================================================================
// Directorio público de especialistas (Ola 3).
//
// Lee `public_therapist_directory`: una VISTA curada que expone SOLO columnas
// seguras (sin número de tarjeta profesional, sin agenda) y SOLO perfiles
// activos y verificados. La barrera vive en la base (la vista + el revoke a
// anon sobre la tabla), no aquí — esta capa solo dibuja.
//
// El directorio capta e informa; el contacto real exige cuenta de paciente
// (`therapist_contact_requests` no acepta anónimos). Por eso desde aquí se
// invita a crear cuenta, nunca se inicia contacto anónimo.
// ============================================================================
import { supabase } from "../supabase";
import type { TherapyModality } from "./therapistService";

export interface PublicTherapist {
  profileId: string;
  name: string;
  bio: string | null;
  specializations: string[];
  languages: string[];
  modalities: TherapyModality[];
  ageGroups: string[];
  acceptsOnline: boolean;
  acceptsInPerson: boolean;
  yearsExperience: number | null;
}

interface DirectoryRow {
  profile_id: string;
  professional_name: string | null;
  bio: string | null;
  specializations: string[] | null;
  languages: string[] | null;
  modalities: TherapyModality[] | null;
  age_groups: string[] | null;
  accepts_online: boolean | null;
  accepts_in_person: boolean | null;
  years_experience: number | null;
}

/** Todos los especialistas públicos (activos + verificados). Anónimo puede leerlos. */
export async function listPublicTherapists(): Promise<PublicTherapist[]> {
  const { data, error } = await supabase
    .from("public_therapist_directory")
    .select(
      "profile_id, professional_name, bio, specializations, languages, modalities, age_groups, accepts_online, accepts_in_person, years_experience",
    )
    .order("professional_name", { ascending: true });
  if (error || !data) return [];

  return (data as DirectoryRow[]).map((r) => ({
    profileId: r.profile_id,
    name: r.professional_name ?? "",
    bio: r.bio,
    specializations: r.specializations ?? [],
    languages: r.languages ?? [],
    modalities: r.modalities ?? [],
    ageGroups: r.age_groups ?? [],
    acceptsOnline: Boolean(r.accepts_online),
    acceptsInPerson: Boolean(r.accepts_in_person),
    yearsExperience: r.years_experience,
  }));
}
