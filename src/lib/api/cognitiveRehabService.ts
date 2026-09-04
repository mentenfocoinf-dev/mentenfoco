// ============================================================================
// Rehabilitación cognitiva — capa de datos.
//
// La LECTURA del catálogo no filtra por plan en el cliente: la RLS de
// `cognitive_exercises` ya devuelve solo lo que el visitante puede ver según su
// etapa (anónimo → los marcados; cuenta → su tier). Aquí solo se filtra por
// EDAD (personalización) y se ordena. El progreso vive en `user_exercise_sessions`
// (owner-only). Los minijuegos son originales (no clones de NeuronUp).
// ============================================================================
import { supabase } from "../supabase";

export type GameKind =
  | "memory_pairs"
  | "stroop_color"
  | "sequence_recall"
  | "calculo_mental"
  | "odd_one_out"
  | "figuras_iguales"
  | "cuenta_rapido"
  | "patron_igual"
  | "que_hora"
  | "emocion_situacion"
  | "ordena_pasos"
  | "forma_palabra"
  | "dia_siguiente"
  | "respuesta_adecuada";
export type Difficulty = "facil" | "medio" | "dificil";
export type AgeBand = "ninos" | "adolescentes" | "adultos" | "adultos_mayores";

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  facil: "Fácil",
  medio: "Medio",
  dificil: "Difícil",
};

/** Etiquetas legibles de los dominios cognitivos (vocabulario propio). */
export const DOMAIN_LABELS: Record<string, string> = {
  memoria_trabajo: "Memoria de trabajo",
  memoria_secuencial: "Memoria secuencial",
  memoria_episodica: "Memoria episódica",
  memoria_semantica: "Memoria semántica",
  atencion_selectiva: "Atención selectiva",
  atencion_sostenida: "Atención sostenida",
  atencion_alternante: "Atención alternante",
  inhibicion: "Inhibición",
  planificacion: "Planificación",
  razonamiento: "Razonamiento",
  flexibilidad: "Flexibilidad cognitiva",
  velocidad_procesamiento: "Velocidad de procesamiento",
  lenguaje: "Lenguaje",
  comprension: "Comprensión",
  relaciones_espaciales: "Relaciones espaciales",
  visualizacion_espacial: "Visualización espacial",
  calculo: "Cálculo",
  orientacion: "Orientación",
  cognicion_social: "Cognición social",
};

export function domainLabel(key: string): string {
  return DOMAIN_LABELS[key] ?? key.replace(/_/g, " ");
}

/** Áreas de rehabilitación (secciones). Cada una debería llegar a ≥5 juegos. */
export interface RehabArea {
  key: string;
  label: string;
  domains: string[];
}

export const REHAB_AREAS: RehabArea[] = [
  { key: "memoria", label: "Memoria", domains: ["memoria_trabajo", "memoria_secuencial", "memoria_episodica", "memoria_semantica"] },
  { key: "atencion", label: "Atención", domains: ["atencion_selectiva", "atencion_sostenida", "atencion_alternante", "inhibicion"] },
  { key: "funciones_ejecutivas", label: "Funciones ejecutivas", domains: ["planificacion", "razonamiento", "flexibilidad"] },
  { key: "velocidad", label: "Velocidad de procesamiento", domains: ["velocidad_procesamiento"] },
  { key: "lenguaje", label: "Lenguaje", domains: ["lenguaje", "comprension"] },
  { key: "visoespacial", label: "Habilidades visoespaciales", domains: ["relaciones_espaciales", "visualizacion_espacial"] },
  { key: "calculo", label: "Cálculo", domains: ["calculo"] },
  { key: "orientacion", label: "Orientación", domains: ["orientacion"] },
  { key: "cognicion_social", label: "Cognición social", domains: ["cognicion_social"] },
];

export interface CognitiveExercise {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  instructions: string | null;
  gameKind: GameKind;
  domains: string[];
  ageBand: AgeBand;
  minPlan: string;
  /** Imagen real opcional; si no hay, se usa una miniatura generada del juego. */
  image?: string | null;
  /** Cada dificultad es un array de subniveles (parámetros ascendentes). */
  config: { levels?: Partial<Record<Difficulty, Record<string, number>[]>> };
}

interface ExerciseRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  instructions: string | null;
  game_kind: GameKind;
  domains: string[] | null;
  age_band: AgeBand;
  min_plan: string;
  config: CognitiveExercise["config"] | null;
}

function mapExercise(r: ExerciseRow): CognitiveExercise {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description,
    instructions: r.instructions,
    gameKind: r.game_kind,
    domains: r.domains ?? [],
    ageBand: r.age_band,
    minPlan: r.min_plan,
    config: r.config ?? {},
  };
}

const COLS =
  "id, slug, title, description, instructions, game_kind, domains, age_band, min_plan, config";

/** Deriva la franja de edad desde una fecha de nacimiento. Sin fecha → adultos. */
export function ageBandFromBirthdate(birthdate: string | null | undefined): AgeBand {
  if (!birthdate) return "adultos";
  const b = new Date(birthdate);
  if (Number.isNaN(b.getTime())) return "adultos";
  const age = Math.floor((Date.now() - b.getTime()) / (365.25 * 24 * 3600 * 1000));
  if (age < 13) return "ninos";
  if (age < 18) return "adolescentes";
  if (age < 65) return "adultos";
  return "adultos_mayores";
}

/** Catálogo visible para el usuario (RLS filtra el tier); se acota por edad. */
export async function listExercises(ageBand: AgeBand = "adultos"): Promise<CognitiveExercise[]> {
  const { data, error } = await supabase
    .from("cognitive_exercises")
    .select(COLS)
    .eq("status", "publicado")
    .eq("age_band", ageBand)
    .order("min_plan", { ascending: true })
    .order("title", { ascending: true });
  if (error || !data) return [];
  return (data as ExerciseRow[]).map(mapExercise);
}

export async function getExerciseBySlug(slug: string): Promise<CognitiveExercise | null> {
  const { data, error } = await supabase
    .from("cognitive_exercises")
    .select(COLS)
    .eq("slug", slug)
    .eq("status", "publicado")
    .maybeSingle();
  if (error || !data) return null;
  return mapExercise(data as ExerciseRow);
}

export interface SessionResult {
  exerciseId: string;
  difficulty: Difficulty;
  score: number;
  accuracy: number; // 0..1
  durationSeconds: number;
  completed: boolean;
}

/** Guarda una partida. Silencioso si no hay sesión (el anónimo juega sin registrar). */
export async function recordSession(r: SessionResult): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) return; // anónimo: no se guarda progreso, pero puede jugar
  await supabase.from("user_exercise_sessions").insert({
    patient_id: session.user.id,
    exercise_id: r.exerciseId,
    difficulty: r.difficulty,
    score: r.score,
    accuracy: r.accuracy,
    duration_seconds: r.durationSeconds,
    completed: r.completed,
  });
}

export interface ExerciseProgress {
  exerciseId: string;
  sessions: number;
  bestScore: number;
  lastAccuracy: number | null;
  completed: boolean;
}

/** Progreso agregado por ejercicio: cuántos completó y en qué mejorar (accuracy). */
export async function listMyProgress(): Promise<Record<string, ExerciseProgress>> {
  const { data, error } = await supabase
    .from("user_exercise_sessions")
    .select("exercise_id, score, accuracy, completed, created_at")
    .order("created_at", { ascending: false });
  if (error || !data) return {};

  const out: Record<string, ExerciseProgress> = {};
  for (const row of data as {
    exercise_id: string;
    score: number | null;
    accuracy: number | null;
    completed: boolean;
    created_at: string;
  }[]) {
    const p = out[row.exercise_id] ?? {
      exerciseId: row.exercise_id,
      sessions: 0,
      bestScore: 0,
      lastAccuracy: null,
      completed: false,
    };
    p.sessions += 1;
    p.bestScore = Math.max(p.bestScore, row.score ?? 0);
    if (p.lastAccuracy === null && row.accuracy != null) p.lastAccuracy = row.accuracy; // el más reciente (orden desc)
    p.completed = p.completed || row.completed;
    out[row.exercise_id] = p;
  }
  return out;
}

/** Registra la aceptación de los términos del apartado (solo usuarios con sesión). */
export async function acceptCognitiveTerms(): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) return;
  await supabase
    .from("profiles")
    .update({ cognitive_terms_accepted_at: new Date().toISOString() })
    .eq("id", session.user.id);
}
