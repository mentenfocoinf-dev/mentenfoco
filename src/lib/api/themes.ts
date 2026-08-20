// ============================================================================
// Eje temático interno del catálogo (`theme_key`).
//
// Es el espejo en TypeScript del enum `theme_key` de Postgres. Los dos tienen
// que decir exactamente lo mismo: la base rechaza un valor inventado, y este
// archivo hace que el compilador lo rechace antes.
//
// Tres ejes ortogonales, cada uno para lo suyo:
//
//   categoria   ¿dónde lo encuentro navegando?   (público, cambia con la nav)
//   tags        ¿con qué enfoque trabaja?        (detalle, cambia con la pieza)
//   theme_key   ¿de qué trata, en el fondo?      (interno, casi nunca cambia)
//
// Un tema es un ÁMBITO DE LA EXPERIENCIA de la persona: ni un diagnóstico —el
// producto orienta, no diagnostica (ADR-007)— ni una técnica, que ya viven en
// los tags.
//
// Hoy ninguna pieza tiene tema: la clasificación es un juicio editorial y
// clínico del responsable del producto, no una tarea de desarrollo. Este módulo
// solo existe para que el motor pueda usarlo en cuanto lo esté.
// ============================================================================

/**
 * Los 15 temas. El orden es el del enum en la base, y el enum es la fuente de
 * verdad: añadir uno aquí sin migrarlo produce valores que la base rechaza.
 */
export const THEME_KEYS = [
  "ansiedad_panico",
  "animo_depresion",
  "sueno_descanso",
  "estres_burnout",
  "autoestima_dialogo_interno",
  "regulacion_presencia",
  "enfoque_procrastinacion",
  "relaciones_vinculos",
  "duelo_perdida",
  "trauma",
  "crianza_infancia",
  "alimentacion",
  "memoria_envejecimiento",
  "neurodivergencia",
  "proceso_terapeutico",
] as const;

export type ThemeKey = (typeof THEME_KEYS)[number];

/** Nombre legible de cada tema. Eje interno: hoy no se muestra en ninguna vista pública. */
export const THEME_LABELS: Record<ThemeKey, string> = {
  ansiedad_panico: "Ansiedad y pánico",
  animo_depresion: "Ánimo y depresión",
  sueno_descanso: "Sueño y descanso",
  estres_burnout: "Estrés y agotamiento",
  autoestima_dialogo_interno: "Autoestima y diálogo interno",
  regulacion_presencia: "Regulación emocional y presencia",
  enfoque_procrastinacion: "Enfoque y procrastinación",
  relaciones_vinculos: "Relaciones y vínculos",
  duelo_perdida: "Duelo y pérdida",
  trauma: "Trauma",
  crianza_infancia: "Crianza y desarrollo infantil",
  alimentacion: "Alimentación y relación con la comida",
  memoria_envejecimiento: "Memoria y envejecimiento",
  neurodivergencia: "Neurodivergencia",
  proceso_terapeutico: "Empezar y sostener un proceso",
};

/**
 * ¿Es un tema válido?
 *
 * La base devuelve `theme_key` como string suelto. Esto convierte cualquier
 * valor desconocido —una fila vieja, un enum ampliado sin desplegar el front—
 * en `null`, que el motor ya sabe tratar: cae al criterio siguiente en vez de
 * consultar por un tema que no existe.
 */
export function isThemeKey(valor: unknown): valor is ThemeKey {
  return typeof valor === "string" && (THEME_KEYS as readonly string[]).includes(valor);
}

/** Normaliza lo que venga de la base a `ThemeKey` o `null`. Nunca lanza. */
export function toThemeKey(valor: unknown): ThemeKey | null {
  return isThemeKey(valor) ? valor : null;
}

// ── Criterios de afinidad ───────────────────────────────────────────────────

/**
 * Por qué se buscan piezas parecidas, en orden de precisión decreciente.
 *
 * `tema` es el único que cruza secciones de verdad: una guía y un artículo del
 * mismo tema hablan de lo mismo aunque sus categorías y sus tags no coincidan.
 */
export type AffinityCriterion = "tema" | "categoria" | "tags";

export interface AffinitySource {
  themeKey?: ThemeKey | null;
  categoria?: string | null;
  tags?: string[] | null;
}

/**
 * Cadena de criterios a probar, del más preciso al menos.
 *
 * Se prueban EN ORDEN y el primero que devuelva algo gana: no se mezclan. Mezclar
 * dejaría que dos coincidencias flojas de tags desplazaran a una del mismo tema,
 * que es justo lo que este eje existe para evitar.
 *
 * Un criterio sin dato se omite, no se prueba en vacío. Con `theme_key = null`
 * en todo el catálogo —el estado de hoy— la cadena empieza en `categoria`, que
 * es exactamente lo que el motor hacía antes de existir este archivo.
 */
export function affinityChain(src: AffinitySource): AffinityCriterion[] {
  const cadena: AffinityCriterion[] = [];
  if (src.themeKey) cadena.push("tema");
  if (src.categoria?.trim()) cadena.push("categoria");
  if (src.tags && src.tags.length > 0) cadena.push("tags");
  return cadena;
}
