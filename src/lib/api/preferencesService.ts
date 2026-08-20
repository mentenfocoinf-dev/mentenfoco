// ============================================================================
// Preferencias declaradas por la persona (onboarding).
//
// Qué te interesa, qué buscas ahora, cómo prefieres que te acompañen y cuándo
// puedes. Nada de esto es clínica: no hay severidad, ni diagnóstico, ni puntaje.
// Sirve para orientar lo que se ofrece, nunca para decidir qué le pasa a nadie.
//
// La lectura va por RPC y no por consulta directa porque el cliente NO tiene
// SELECT sobre `user_preferences`, y no debe tenerlo: saber que alguien entró
// pidiendo duelo y trauma dice tanto como una respuesta de un test. La función
// filtra por `auth.uid()` internamente. Escribir sí es directo — lo protege el
// trigger de propiedad.
// ============================================================================
import { supabase } from "../supabase";
import type { ThemeKey } from "./themes";
import type { AvailabilitySlot, TherapyModality } from "./therapistService";

/** Qué busca la persona AHORA. Cambia, y se puede volver a elegir. */
export type OnboardingGoal = "entender" | "practicar" | "hablar_con_alguien";

export const GOAL_LABELS: Record<OnboardingGoal, string> = {
  entender: "Entender qué me pasa",
  practicar: "Tener herramientas concretas",
  hablar_con_alguien: "Hablar con un profesional",
};

export const GOAL_HINTS: Record<OnboardingGoal, string> = {
  entender: "Te llevamos primero a lecturas que explican el porqué.",
  practicar: "Te llevamos primero a ejercicios y prácticas breves.",
  hablar_con_alguien: "Te mostramos con quién de nuestro equipo puedes hablar.",
};

/** Tope deliberado: pedir más temas produce una lista que no prioriza nada. */
export const MAX_TEMAS = 3;

export interface UserPreferences {
  themes: ThemeKey[];
  goal: OnboardingGoal | null;
  language: string | null;
  modalities: TherapyModality[];
  availability: AvailabilitySlot[];
  /** `null` = empezado y no terminado. El onboarding no bloquea nada. */
  completedAt: string | null;
}

export type UserPreferencesInput = Partial<Omit<UserPreferences, "completedAt">> & {
  completed?: boolean;
};

/**
 * Las preferencias de quien tiene la sesión abierta.
 *
 * `null` cuando no existen todavía —el estado normal antes del onboarding— y
 * también sin sesión o si la consulta falla: no saber qué prefiere alguien
 * nunca puede romper una pantalla.
 */
export async function getMyPreferences(): Promise<UserPreferences | null> {
  try {
    const { data, error } = await supabase.rpc("get_my_preferences");
    if (error || !data) return null;

    const fila = (data as Record<string, unknown>[])[0];
    if (!fila) return null;

    return {
      themes: Array.isArray(fila.themes) ? (fila.themes as ThemeKey[]) : [],
      goal: (fila.goal as OnboardingGoal) ?? null,
      language: (fila.language as string) ?? null,
      modalities: Array.isArray(fila.modalities) ? (fila.modalities as TherapyModality[]) : [],
      availability: Array.isArray(fila.availability)
        ? (fila.availability as AvailabilitySlot[])
        : [],
      completedAt: (fila.completed_at as string) ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Guarda las preferencias de quien tiene la sesión abierta.
 *
 * Upsert: empezar y editar son el mismo gesto. `completed` marca el final del
 * flujo, pero guardar sin terminarlo es válido — se puede abandonar a medias y
 * retomar.
 */
export async function saveMyPreferences(input: UserPreferencesInput): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const id = session?.user?.id;
  if (!id) throw new Error("Necesitas iniciar sesión para guardar tus preferencias.");

  const fila: Record<string, unknown> = { profile_id: id };
  if (input.themes) fila.themes = input.themes.slice(0, MAX_TEMAS);
  if (input.goal !== undefined) fila.goal = input.goal;
  if (input.language !== undefined) fila.language = input.language;
  if (input.modalities) fila.modalities = input.modalities;
  if (input.availability) fila.availability = input.availability;
  if (input.completed) fila.completed_at = new Date().toISOString();

  // Actualizar y, si no había fila, insertar. Antes era un `upsert`, pero
  // `ON CONFLICT DO UPDATE` exige privilegio SELECT sobre CADA columna que
  // escribe, y aquí eso significaría abrir la lectura de los temas que la
  // persona eligió — justo el dato que esta tabla protege. Partirlo en dos
  // sentencias hace el mismo trabajo leyendo solo `profile_id`.
  //
  // La carrera entre las dos sentencias no importa: la clave primaria impide
  // duplicados y el trigger de propiedad impide escribir en fila ajena.
  const { data, error } = await supabase
    .from("user_preferences")
    .update(fila)
    .eq("profile_id", id)
    .select("profile_id");

  if (!error && (data?.length ?? 0) === 0) {
    const { error: errorAlta } = await supabase.from("user_preferences").insert(fila);
    if (errorAlta) {
      if (errorAlta.message.includes("USER_PREFERENCES_FORBIDDEN")) {
        throw new Error("Solo puedes editar tus propias preferencias.");
      }
      throw new Error("No se pudieron guardar tus preferencias.");
    }
    return;
  }

  if (error) {
    if (error.message.includes("USER_PREFERENCES_FORBIDDEN")) {
      throw new Error("Solo puedes editar tus propias preferencias.");
    }
    throw new Error("No se pudieron guardar tus preferencias.");
  }
}
