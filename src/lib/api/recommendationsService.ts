// ============================================================================
// Recommendation Engine — Fase 1.
//
// Motor de REGLAS, determinista y auditable. Sin modelos, sin embeddings, sin
// similitud semántica (ADR-007): recomendar contenido clínico es una tarea
// donde el error no es visible ni reversible.
//
// ── Las reglas de esta fase ─────────────────────────────────────────────────
//
//   C1  Dentro de un programa el motor SE APAGA. `program_steps` es una ruta
//       curada por criterio clínico y compite mejor que cualquier regla.
//   C7  Nunca se recomiendan dos programas a la vez.
//   B4  Afinidad por `categoria`, priorizando OTRO `content_type` — es la
//       transición de ADR-009 (entender → practicar) con lo que hay hoy.
//   G1  Nunca la pieza que se está leyendo.
//   G3  Máximo 3, con máximo 2 del mismo tipo.
//   G8  Si no queda nada válido, NO se muestra el bloque. Nunca se rellena.
//
// ── Lo que este motor NO hace, y no es un olvido ────────────────────────────
//
// No mira `severity_level`, ni puntajes, ni bandas de test. Recomendar por
// gravedad clínica es recomendar por vulnerabilidad (ADR-004). Aquí se
// recomienda por lo que la persona BUSCA, nunca por lo mal que puntuó.
//
// La etapa de acompañamiento no es condición de ninguna regla: es un filtro
// ciego aplicado al final. El motor razona sobre temas; el filtro decide qué de
// eso es visible. Así ninguna recomendación puede nacer de "te falta esto".
//
// ── Sobre qué eje se mide la afinidad ───────────────────────────────────────
//
// Tres criterios, del más preciso al menos, y se prueban EN ORDEN:
//
//   tema       `theme_key`. El único que cruza secciones de verdad: una guía y
//              un artículo del mismo tema hablan de lo mismo aunque su categoría
//              y sus tags no coincidan.
//   categoria  el eje público de navegación. Cruza guías y contenido en 5 de 9
//              valores (Ánimo, Ansiedad, Autoestima, Relaciones, Trauma).
//   tags       el eje de técnica y detalle. Último recurso: los vocabularios de
//              guías y contenido son casi disjuntos (42 y 65 tags, 2 compartidos).
//
// El primero que devuelva algo gana; no se mezclan. Mezclar dejaría que dos
// coincidencias flojas de tags desplazaran a una del mismo tema.
//
// Hoy ninguna pieza tiene `theme_key`: la clasificación es una decisión
// editorial pendiente. Con el eje entero en `null`, la cadena arranca en
// `categoria` y el motor se comporta exactamente como antes de este cambio.
// ============================================================================
import { supabase, type PlanType } from "../supabase";
import { allowedPlans } from "./plans";
import { getViewerPlan, clearViewerPlanCache } from "./guidesService";
import { LIBRARY_TYPES, type ContentType } from "./contentService";
import { affinityChain, toThemeKey, type AffinityCriterion, type ThemeKey } from "./themes";

export type RecommendationSource = "contenido" | "guia" | "blog";

/** 'guia' para las guías clínicas; el content_type real para el resto. */
export type RecommendationKind = ContentType | "guia";

export interface Recommendation {
  /** Slug para contenido y blog; id para guías. */
  id: string;
  titulo: string;
  descripcion: string;
  categoria: string;
  tipo: RecommendationKind;
  tiempo: string | null;
  imagen: string | null;
  /** Ruta ya resuelta: el componente no construye URLs. */
  href: string;
  /** Tema de la pieza recomendada, si ya está clasificada. */
  themeKey: ThemeKey | null;
  /** Qué regla lo trajo. Se registra para poder medir qué reglas sirven. */
  regla: string;
}

export interface RecommendationContext {
  source: RecommendationSource;
  /** Slug (contenido/blog) o id (guía) de la pieza actual. */
  currentId: string;
  categoria: string;
  tipoActual: RecommendationKind;
  /**
   * Tema de la pieza actual. Opcional a propósito: un lector que todavía no lo
   * pase se comporta igual que hoy, cayendo a `categoria`.
   */
  themeKey?: ThemeKey | null;
  /** Tags de la pieza actual. Último criterio de la cadena. */
  tags?: string[] | null;
}

const MAX_RECOMENDACIONES = 3;
/** Diversidad forzada: tres artículos seguidos no son tres recomendaciones. */
const MAX_POR_TIPO = 2;
/** Tope por consulta. Con 46 piezas ninguna categoría se acerca. */
const LIMITE_CONSULTA = 20;

// ── Funciones puras ─────────────────────────────────────────────────────────
// Exportadas para poder probarlas sin red. Toda la lógica de decisión vive
// aquí; las consultas solo traen candidatos.

// El filtro de etapa vive en plans.ts: contenido, guías y este motor tienen que
// aplicar el mismo criterio o el motor recomendaría piezas que el lector no
// encuentra. Se re-exporta porque es parte del contrato probado del motor.
export { allowedPlans } from "./plans";

/**
 * Minutos declarados, para ordenar por esfuerzo.
 *
 * Formatos reales: "8 min", "12 min", "Ruta de 4 pasos". Lo que no trae minutos
 * se manda al final: ante la duda, una pieza de duración desconocida es peor
 * sugerencia que una de la que sabemos que son 3 minutos.
 *
 * Ojo con "Ruta de 4 pasos": el 4 NO son minutos. Por eso se exige que el número
 * vaya seguido de "min" y no se acepta un número suelto.
 */
export function minutos(texto: string | null | undefined): number {
  if (!texto) return 999;
  const m = /(\d+)\s*min/i.exec(texto);
  if (!m) return 999;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : 999;
}

/**
 * Orden por cascada lexicográfica, no por suma de pesos.
 *
 * Un scoring ponderado dejaría que tres señales débiles vencieran a una fuerte,
 * y ahí es por donde se cuela la conversión. El primer criterio que discrimina
 * decide; los siguientes no votan:
 *
 *   1. Tipo DISTINTO al actual — la transición de ADR-009. Quien acaba de
 *      entender el porqué necesita el cómo, no otro artículo.
 *   2. Menos minutos primero — alguien que está mal tiene poca energía, y una
 *      lectura de 20 minutos es una barrera para aceptar la sugerencia.
 *   3. Id — determinismo. Mismo estado, misma salida.
 */
export function ordenarCandidatos(
  candidatos: Recommendation[],
  tipoActual: RecommendationKind,
): Recommendation[] {
  return [...candidatos].sort((a, b) => {
    const aDistinto = a.tipo !== tipoActual ? 0 : 1;
    const bDistinto = b.tipo !== tipoActual ? 0 : 1;
    if (aDistinto !== bDistinto) return aDistinto - bDistinto;

    const dm = minutos(a.tiempo) - minutos(b.tiempo);
    if (dm !== 0) return dm;

    return a.id.localeCompare(b.id);
  });
}

/**
 * Aplica G1 (nunca la actual), G3 (tope y diversidad) y deduplica.
 *
 * La deduplicación no es teórica: una guía y un contenido pueden compartir id/
 * slug, y sin esto la misma pieza podría aparecer dos veces con distinto tipo.
 * La clave es tipo+id, no id solo.
 */
export function seleccionar(
  ordenados: Recommendation[],
  currentId: string,
): Recommendation[] {
  const porTipo = new Map<string, number>();
  const vistos = new Set<string>();
  const salida: Recommendation[] = [];

  for (const c of ordenados) {
    if (salida.length >= MAX_RECOMENDACIONES) break;
    if (c.id === currentId) continue; // G1

    const clave = `${c.tipo}:${c.id}`;
    if (vistos.has(clave)) continue;

    const n = porTipo.get(c.tipo) ?? 0;
    if (n >= MAX_POR_TIPO) continue;

    vistos.add(clave);
    porTipo.set(c.tipo, n + 1);
    salida.push(c);
  }
  return salida;
}

/** C1 + C7: un programa apaga el motor; un programa nunca se sugiere. */
export function motorApagado(tipoActual: RecommendationKind): boolean {
  return tipoActual === "programa";
}

// ── Caché de resultados ─────────────────────────────────────────────────────
//
// Solo el resultado por pieza: volver atrás a una pieza ya vista no debe
// repetir las consultas. La etapa del viewer NO se cachea aquí — vive en
// guidesService, junto a getViewerPlan(), para que contentService y este
// servicio compartan la misma resolución en vez de mantener cada uno la suya.
//
// En memoria y por pestaña: no se persiste. Un recargo real recalcula, que es lo
// correcto — el catálogo puede haber cambiado.

const RESULT_TTL_MS = 5 * 60_000;
const RESULT_CACHE_MAX = 50;

const resultCache = new Map<string, { valor: Recommendation[]; expira: number }>();

function claveCache(ctx: RecommendationContext, plan: PlanType): string {
  // El tema entra en la clave: clasificar una pieza cambia lo que se recomienda
  // desde ella, y sin esto lo anterior seguiría vivo hasta cinco minutos.
  return [
    plan,
    ctx.source,
    ctx.tipoActual,
    ctx.themeKey ?? "-",
    ctx.categoria,
    ctx.currentId,
  ].join("|");
}

function podarCache(): void {
  const ahora = Date.now();
  for (const [k, v] of resultCache) if (v.expira <= ahora) resultCache.delete(k);
  // Si sigue grande tras podar lo caducado, se suelta lo más antiguo. Map
  // preserva orden de inserción, así que el primero es el más viejo.
  while (resultCache.size > RESULT_CACHE_MAX) {
    const primera = resultCache.keys().next().value;
    if (primera === undefined) break;
    resultCache.delete(primera);
  }
}

/**
 * Invalida los resultados cacheados y la etapa compartida. Se llama al iniciar o
 * cerrar sesión: la etapa cambia y con ella lo que la persona puede ver.
 */
export function clearRecommendationCache(): void {
  resultCache.clear();
  clearViewerPlanCache();
}

// ── Punto de entrada ────────────────────────────────────────────────────────

/**
 * Recomendaciones para la pieza que se está leyendo.
 *
 * Devuelve `[]` con normalidad: un bloque vacío es mejor que uno relleno. Nunca
 * lanza — si una consulta falla, la persona simplemente no ve sugerencias.
 */
export async function getRecommendations(
  ctx: RecommendationContext,
): Promise<Recommendation[]> {
  // C1: dentro de un programa el lector ya muestra los pasos ordenados.
  // Sugerir algo lateral rompería la ruta que un profesional diseñó.
  if (motorApagado(ctx.tipoActual)) return [];

  // Sin ningún eje sobre el que medir afinidad no hay nada que calcular y la
  // consulta traería basura. Con solo `categoria` —el caso de hoy— la cadena
  // tiene un elemento y esto equivale a la comprobación que había antes.
  const cadena = affinityChain(ctx);
  if (cadena.length === 0) return [];

  try {
    const plan = await getViewerPlan();

    const clave = claveCache(ctx, plan);
    const enCache = resultCache.get(clave);
    if (enCache && enCache.expira > Date.now()) return enCache.valor;

    const planes = allowedPlans(plan);

    // Se prueba criterio por criterio y gana el primero que devuelva algo. No se
    // acumulan candidatos entre criterios: una coincidencia de tags no debe poder
    // colarse junto a una del mismo tema.
    let salida: Recommendation[] = [];
    for (const criterio of cadena) {
      const [contenido, guias] = await Promise.all([
        buscarContenido(ctx, planes, criterio),
        buscarGuias(ctx, planes, criterio),
      ]);

      salida = seleccionar(
        ordenarCandidatos([...contenido, ...guias], ctx.tipoActual),
        ctx.currentId,
      );
      // G8 se aplica al final de la cadena, no en cada vuelta: quedarse sin
      // candidatos por un criterio no es quedarse sin candidatos.
      if (salida.length > 0) break;
    }

    resultCache.set(clave, { valor: salida, expira: Date.now() + RESULT_TTL_MS });
    podarCache();
    return salida;
  } catch (err) {
    console.error("[recommendations] no se pudieron calcular:", err);
    return [];
  }
}

/** Sufijo de `regla` según el eje que trajo la pieza. Se registra para medirlo. */
const ETIQUETA_CRITERIO: Record<AffinityCriterion, string> = {
  // 'categoria' no lleva sufijo: es la etiqueta que el motor viene registrando y
  // cambiarla rompería la serie histórica del Journey.
  categoria: "",
  tema: "-tema",
  tags: "-tags",
};

async function buscarContenido(
  ctx: RecommendationContext,
  planes: PlanType[],
  criterio: AffinityCriterion,
): Promise<Recommendation[]> {
  // C7: los programas se excluyen del conjunto de tipos buscados, no con un
  // `neq` posterior. Un filtro menos que evaluar y una intención más clara.
  const tipos = LIBRARY_TYPES.filter((t) => t !== "programa");

  let query = supabase
    .from("content_items_meta")
    .select(
      "slug, titulo, resumen_breve, categoria, content_type, tiempo_lectura, cover_image, theme_key",
    )
    .eq("status", "publicado")
    .in("min_plan", planes)
    // El blog es una sección aparte y no se recomienda como biblioteca (ADR-009).
    .in("content_type", tipos);

  const filtro = filtroDe(ctx, criterio, "tags");
  query =
    filtro.modo === "eq"
      ? query.eq(filtro.columna, filtro.valor)
      : query.overlaps(filtro.columna, filtro.valor);

  const { data, error } = await query.limit(LIMITE_CONSULTA);

  if (error || !data) return [];

  return (data as Record<string, string | null>[])
    .filter((r) => Boolean(r.slug))
    .map((r) => ({
      id: r.slug as string,
      titulo: (r.titulo as string) ?? "",
      descripcion: (r.resumen_breve as string) ?? "",
      categoria: (r.categoria as string) ?? "",
      tipo: r.content_type as ContentType,
      tiempo: r.tiempo_lectura,
      imagen: r.cover_image ? `/contenido/${r.cover_image}` : null,
      href: `/contenido/${r.slug}`,
      themeKey: toThemeKey(r.theme_key),
      regla: `B4${ETIQUETA_CRITERIO[criterio]}-contenido`,
    }));
}

async function buscarGuias(
  ctx: RecommendationContext,
  planes: PlanType[],
  criterio: AffinityCriterion,
): Promise<Recommendation[]> {
  let query = supabase
    .from("clinical_guides_meta")
    .select(
      'id, titulo, "descripcionBreve", categoria, "tiempoLectura", "imageName", theme_key',
    )
    .in("min_plan", planes);

  const filtro = filtroDe(ctx, criterio, "etiquetas");
  query =
    filtro.modo === "eq"
      ? query.eq(filtro.columna, filtro.valor)
      : query.overlaps(filtro.columna, filtro.valor);

  const { data, error } = await query.limit(LIMITE_CONSULTA);

  if (error || !data) return [];

  return (data as Record<string, string | null>[])
    .filter((r) => Boolean(r.id))
    .map((r) => ({
      id: r.id as string,
      titulo: (r.titulo as string) ?? "",
      descripcion: (r.descripcionBreve as string) ?? "",
      categoria: (r.categoria as string) ?? "",
      tipo: "guia" as const,
      tiempo: r.tiempoLectura,
      imagen: r.imageName ? `/guias/${r.imageName}` : null,
      href: `/guias/${r.id}`,
      themeKey: toThemeKey(r.theme_key),
      regla: `B4${ETIQUETA_CRITERIO[criterio]}-guia`,
    }));
}

/**
 * Traduce el criterio en curso a un filtro concreto.
 *
 * Es lo único que cambia entre los tres ejes: el resto de la consulta —estado,
 * etapa, tipos— es idéntico en los tres, y así se mantiene. Se devuelve como
 * descripción en vez de aplicarse aquí para no tener que tipar el builder de
 * PostgREST, que cambia de forma en cada `.eq()`.
 */
type FiltroAfinidad =
  | { modo: "eq"; columna: string; valor: string }
  | { modo: "overlaps"; columna: string; valor: string[] };

function filtroDe(
  ctx: RecommendationContext,
  criterio: AffinityCriterion,
  columnaTags: "tags" | "etiquetas",
): FiltroAfinidad {
  switch (criterio) {
    case "tema":
      return { modo: "eq", columna: "theme_key", valor: ctx.themeKey as string };
    case "tags":
      // Las guías guardan sus etiquetas en `etiquetas` y el contenido en `tags`:
      // la misma idea con distinto nombre, heredado del esquema original.
      return { modo: "overlaps", columna: columnaTags, valor: ctx.tags ?? [] };
    case "categoria":
    default:
      return { modo: "eq", columna: "categoria", valor: ctx.categoria };
  }
}
