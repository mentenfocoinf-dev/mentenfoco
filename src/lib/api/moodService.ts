// ============================================================================
// Registro diario de estado de ánimo.
//
// Seguimiento personal del paciente: no alimenta alertas ni diagnóstico. La
// tabla tiene UNIQUE (patient_id, entry_date), así que el guardado es un upsert
// y volver a marcar el mismo día corrige el registro en vez de duplicarlo.
// ============================================================================
import { supabase } from "../supabase";

export type MoodValue = 1 | 2 | 3 | 4 | 5;

export interface MoodOption {
  value: MoodValue;
  label: string;
}

export const MOOD_OPTIONS: MoodOption[] = [
  { value: 1, label: "Muy mal" },
  { value: 2, label: "Mal" },
  { value: 3, label: "Regular" },
  { value: 4, label: "Bien" },
  { value: 5, label: "Muy bien" },
];

/** Fecha local en formato YYYY-MM-DD. No se usa toISOString(): convierte a UTC
 *  y en las madrugadas colombianas registraría el día siguiente. */
function todayLocal(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Ánimo registrado hoy, o null si aún no ha marcado. */
export async function getTodayMood(patientId: string): Promise<MoodValue | null> {
  const { data } = await supabase
    .from("mood_entries")
    .select("mood")
    .eq("patient_id", patientId)
    .eq("entry_date", todayLocal())
    .maybeSingle();
  return (data?.mood as MoodValue) ?? null;
}

export async function saveTodayMood(patientId: string, mood: MoodValue) {
  const { error } = await supabase.from("mood_entries").upsert(
    {
      patient_id: patientId,
      entry_date: todayLocal(),
      mood,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "patient_id,entry_date" },
  );
  if (error) throw new Error(error.message);
}
