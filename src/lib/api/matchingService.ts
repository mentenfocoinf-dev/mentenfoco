// ============================================================================
// Matching Clínico — MVP.
//
// Recomienda PROFESIONAL, no contenido. Son dos preguntas distintas y por eso
// son dos motores distintos: el Recommendation Engine responde "qué leo ahora",
// esto responde "con quién debería hablar".
//
// Motor de reglas, determinista y explicable. Sin modelos, sin embeddings, sin
// probabilidades: quien recibe el resultado tiene que poder ver POR QUÉ salió
// ese profesional, y por eso cada match viaja con la lista de criterios que
// coincidieron. Un número solo no es una explicación.
//
// ── El orden de prioridad, y por qué los pesos son potencias de dos ─────────
//
//   1. Especialidad clínica   16
//   2. Motivo principal        8
//   3. Idioma                  4
//   4. Modalidad               2
//   5. Disponibilidad          1
//
// Cada criterio pesa más que TODOS los inferiores juntos (8+4+2+1 = 15 < 16).
// Así la suma se comporta como un orden lexicográfico: tres coincidencias
// flojas nunca desplazan a una de especialidad. Un scoring con pesos "razonables"
// —5, 4, 3, 2, 1— dejaría que idioma + modalidad + disponibilidad ganaran a la
// especialidad clínica, y eso es exactamente el error que no se puede cometer
// al derivar a una persona a un profesional.
//
// ── Lo que este motor NO mira, y no es un olvido ────────────────────────────
//
// Ni `severity_level`, ni puntajes de test, ni bandas, ni diagnósticos. Derivar
// por gravedad sería derivar por vulnerabilidad (ADR-004). Y la etapa del
// usuario se acepta en la entrada pero NO puntúa: qué contenido ves depende de
// tu etapa, quién te atiende no. Un profesional mejor para quien paga más es
// justo lo que la constitución del producto prohíbe.
//
// ── Estado de los datos (3-ago-2026) ────────────────────────────────────────
//
// `profiles` NO tiene todavía especialidades, idiomas, modalidad ni
// disponibilidad — el perfil profesional sigue marcado como pendiente en el
// panel del terapeuta. Este motor lee lo que existe y trata lo ausente como
// "no coincide", nunca como "coincide". Con los datos de hoy no devuelve a
// nadie, que es la respuesta correcta: recomendar un profesional sin ninguna
// base es peor que no recomendar ninguno.
// ============================================================================
import type { PlanType } from "../supabase";
import type { ThemeKey } from "./themes";
import { listTherapists, type TherapyModality } from "./therapistService";

export type Modalidad = "virtual" | "presencial" | "mixta";

/** Los cinco criterios, en su orden de prioridad. */
export type MatchCriterion =
  | "especialidad"
  | "motivo"
  | "idioma"
  | "modalidad"
  | "disponibilidad";

/**
 * Entrada del matching. Todo opcional: se puntúa con lo que haya.
 *
 * Nada de esto es un modelo nuevo — `motivo` y `especialidades` usan el mismo
 * vocabulario editorial que ya clasifica el catálogo, que es precisamente lo
 * que permite que contenido y profesionales hablen el mismo idioma.
 */
export interface MatchingInput {
  /** Motivo principal de consulta, en el vocabulario de temas. */
  motivo?: ThemeKey | null;
  /** Especialidades buscadas. Puede incluir o no al motivo. */
  especialidades?: ThemeKey[] | null;
  /** Categorías de navegación por las que ha pasado la persona. */
  categorias?: string[] | null;
  idioma?: string | null;
  modalidad?: Modalidad | null;
  /** Franjas de disponibilidad, tal como las declare el perfil. */
  disponibilidad?: string[] | null;
  /**
   * Etapa del usuario. Se acepta para poder registrarla, pero NO puntúa.
   * Ver la cabecera: quién te atiende no depende de lo que pagas.
   */
  etapa?: PlanType | null;
}

/** Perfil profesional tal como lo consume el motor. */
export interface TherapistProfile {
  id: string;
  nombre: string;
  avatarUrl: string | null;
  especialidades: ThemeKey[];
  idiomas: string[];
  modalidad: Modalidad | null;
  disponibilidad: string[];
}

export interface TherapistMatch {
  therapistId: string;
  nombre: string;
  avatarUrl: string | null;
  score: number;
  /** Qué coincidió, en orden de prioridad. Es la explicación del resultado. */
  coincidencias: MatchCriterion[];
}

const PESOS: Record<MatchCriterion, number> = {
  especialidad: 16,
  motivo: 8,
  idioma: 4,
  modalidad: 2,
  disponibilidad: 1,
};

/** Máximo de profesionales devueltos. Una lista larga no es una recomendación. */
const MAX_RESULTADOS = 3;

/** Comparación de texto tolerante a mayúsculas y acentos ("Español" = "espanol"). */
function normalizar(valor: string): string {
  return valor
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function hayInterseccion(a: readonly string[], b: readonly string[]): boolean {
  const set = new Set(a.map(normalizar));
  return b.some((x) => set.has(normalizar(x)));
}

/**
 * Criterios que coinciden entre una persona y un profesional.
 *
 * Un criterio sin dato —en cualquiera de los dos lados— NO coincide. Nunca se
 * da por bueno lo que no consta: un perfil vacío no puede parecer un perfil
 * compatible.
 */
function coincidenciasDe(input: MatchingInput, t: TherapistProfile): MatchCriterion[] {
  const out: MatchCriterion[] = [];

  const buscadas = input.especialidades ?? [];
  if (buscadas.length > 0 && t.especialidades.length > 0 && hayInterseccion(buscadas, t.especialidades)) {
    out.push("especialidad");
  }

  if (input.motivo && t.especialidades.some((e) => e === input.motivo)) {
    out.push("motivo");
  }

  if (input.idioma && t.idiomas.length > 0 && hayInterseccion([input.idioma], t.idiomas)) {
    out.push("idioma");
  }

  // 'mixta' cubre las dos: quien atiende de las dos formas sirve para ambas.
  if (input.modalidad && t.modalidad) {
    if (t.modalidad === "mixta" || t.modalidad === input.modalidad) out.push("modalidad");
  }

  const franjas = input.disponibilidad ?? [];
  if (franjas.length > 0 && t.disponibilidad.length > 0 && hayInterseccion(franjas, t.disponibilidad)) {
    out.push("disponibilidad");
  }

  return out;
}

function puntuar(coincidencias: MatchCriterion[]): number {
  return coincidencias.reduce((suma, c) => suma + PESOS[c], 0);
}

/**
 * Los profesionales más adecuados para esta consulta.
 *
 * Devuelve como máximo tres, ordenados por score. **Un profesional que no
 * coincide en nada no se devuelve**: sin ninguna base, la lista sería un orden
 * arbitrario disfrazado de recomendación. Devolver menos —o ninguno— es la
 * respuesta honesta.
 *
 * Nunca lanza: si la consulta falla, no hay match y quien llama no dibuja nada.
 */
export async function matchTherapists(input: MatchingInput): Promise<TherapistMatch[]> {
  try {
    const perfiles = await cargarPerfiles();

    return perfiles
      .map((t) => {
        const coincidencias = coincidenciasDe(input, t);
        return {
          therapistId: t.id,
          nombre: t.nombre,
          avatarUrl: t.avatarUrl,
          score: puntuar(coincidencias),
          coincidencias,
        };
      })
      .filter((m) => m.score > 0)
      // Determinismo completo: a igual score decide el nombre, y a igual nombre
      // el id. Misma entrada, misma salida, siempre.
      .sort((a, b) =>
        b.score !== a.score
          ? b.score - a.score
          : a.nombre.localeCompare(b.nombre) || a.therapistId.localeCompare(b.therapistId),
      )
      .slice(0, MAX_RESULTADOS);
  } catch (err) {
    console.error("[matching] no se pudo calcular:", err);
    return [];
  }
}

/**
 * Perfiles profesionales disponibles, desde `therapist_profiles`.
 *
 * Solo entran los **verificados**: recomendar a un paciente un profesional
 * cuyas credenciales nadie ha revisado no es una recomendación incompleta, es
 * una recomendación que no se debe hacer. `listTherapists()` ya descarta los
 * inactivos.
 *
 * Lo ausente sigue tratándose como "no coincide", nunca como "coincide": un
 * perfil a medio rellenar no puede parecer un perfil compatible.
 */
async function cargarPerfiles(): Promise<TherapistProfile[]> {
  const perfiles = await listTherapists();

  return perfiles
    .filter((t) => t.verified)
    .map((t) => ({
      id: t.profile_id,
      nombre: t.professional_name ?? "",
      avatarUrl: null,
      especialidades: t.specializations ?? [],
      idiomas: t.languages ?? [],
      modalidad: modalidadDe(t.modalities ?? []),
      disponibilidad: t.availability ?? [],
    }));
}

/**
 * Traduce las modalidades declaradas al valor único que puntúa el motor.
 *
 * La base guarda un array —lo honesto: se atiende de una forma, de otra, o de
 * las dos— y el algoritmo puntúa un solo valor con 'mixta' cubriendo ambas.
 * La conversión vive aquí, en la lectura, para no tocar las reglas.
 */
function modalidadDe(modalities: readonly TherapyModality[]): Modalidad | null {
  const virtual = modalities.includes("virtual");
  const presencial = modalities.includes("presencial");
  if (virtual && presencial) return "mixta";
  if (virtual) return "virtual";
  if (presencial) return "presencial";
  return null;
}
