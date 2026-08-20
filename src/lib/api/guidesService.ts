// ============================================================================
// Servicio de guías clínicas.
//
// MODELO DE ACCESO (cambiado el 28-jul): no se muestra contenido bloqueado.
// El usuario ve, completas, solo las guías que su plan incluye; las demás
// simplemente no aparecen. No hay candados ni paywall en ningún camino.
// `min_plan` sigue definiendo desde qué plan aparece cada guía — lo que cambió
// es que el listado FILTRA por él en vez de traer todo y bloquear.
//
// Nota: `visible_en_plan_gratis` ya no participa del control de acceso; el
// gating es únicamente por plan_rank(min_plan) <= plan_rank(plan del usuario).
// La columna se conserva porque describe la vitrina de captación de leads.
// ============================================================================
import { supabase, type PlanType } from "../supabase";
import { allowedPlans } from "./plans";
import type { ThemeKey } from "./themes";

export interface GuideMeta {
  id: string;
  categoria: string;
  etiquetas: string[] | null;
  titulo: string;
  descripcionBreve: string;
  tiempoLectura: string;
  imageName: string;
  es_premium: boolean;
  min_plan: PlanType;
  visible_en_plan_gratis: boolean;
  /** Eje temático interno. Mismo enum que el contenido: es lo que cruza secciones. */
  theme_key: ThemeKey | null;
}

export interface GuideFull extends GuideMeta {
  fundamentoClinico: string;
  ejercicioPractico: string;
  contenidoCompleto: string | null;
}

// ── Resolución del plan del viewer ──────────────────────────────────────────
//
// La resuelven guidesService, contentService y recommendationsService, varias
// veces por navegación: un hub, un detalle y un bloque de recomendaciones eran
// tres resoluciones para el mismo dato, que no cambia entre ellas.
//
// La caché vive AQUÍ, junto a la función, y no en cada consumidor: así los tres
// se benefician sin cambiar ninguna interfaz pública.
//
// TTL corto a propósito. Un cambio de etapa hecho por el admin debe reflejarse
// sin que la persona tenga que recargar del todo; y el caso que de verdad
// importa —entrar o salir de la sesión— se invalida de forma explícita desde
// authService, no por vencimiento.
const VIEWER_PLAN_TTL_MS = 60_000;
let viewerPlanCache: { valor: PlanType; expira: number } | null = null;
/** Resolución en vuelo: dos llamadas simultáneas comparten la misma petición. */
let viewerPlanEnVuelo: Promise<PlanType> | null = null;

/** Invalida el plan cacheado. Se llama al iniciar y al cerrar sesión. */
export function clearViewerPlanCache(): void {
  viewerPlanCache = null;
  viewerPlanEnVuelo = null;
}

/**
 * Plan efectivo del usuario para decidir qué contenido ve.
 *
 * Terapeutas y admin obtienen el nivel máximo: necesitan ver todo el material
 * que trabajan con sus pacientes, y en la base figuran con plan_type='free'.
 * Sin sesión = 'free'.
 *
 * Cacheada y con deduplicación de llamadas concurrentes: el detalle de una
 * pieza y su bloque de recomendaciones arrancan a la vez, y sin esto lanzaban
 * dos resoluciones en paralelo del mismo dato.
 */
export async function getViewerPlan(): Promise<PlanType> {
  const ahora = Date.now();
  if (viewerPlanCache && viewerPlanCache.expira > ahora) return viewerPlanCache.valor;
  if (viewerPlanEnVuelo) return viewerPlanEnVuelo;

  viewerPlanEnVuelo = resolverViewerPlan()
    .then((valor) => {
      viewerPlanCache = { valor, expira: Date.now() + VIEWER_PLAN_TTL_MS };
      return valor;
    })
    .finally(() => {
      viewerPlanEnVuelo = null;
    });

  return viewerPlanEnVuelo;
}

async function resolverViewerPlan(): Promise<PlanType> {
  // getSession() lee de memoria; getUser() valida contra el servidor. Para saber
  // qué contenido mostrar basta el id de la sesión, y esto ahorra una petición
  // de red en cada resolución.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return "free";

  const { data } = await supabase
    .from("profiles")
    .select("role, plan_type")
    .eq("id", userId)
    .maybeSingle();

  if (!data) return "free";
  if (data.role === "admin" || data.role === "therapist") return "premium";
  return (data.plan_type as PlanType) ?? "free";
}

/**
 * Lista las guías que el plan del usuario incluye. Lo que no incluye, no se
 * devuelve: la UI nunca tiene que dibujar un candado.
 */
export async function listGuides(): Promise<GuideMeta[]> {
  const plan = await getViewerPlan();

  const { data, error } = await supabase
    .from("clinical_guides_meta")
    .select("*")
    .in("min_plan", allowedPlans(plan))
    .order("titulo");
  if (error) {
    console.error("[guidesService] Error listando guías:", error.message);
    return [];
  }
  return (data ?? []) as GuideMeta[];
}

/**
 * Obtiene una guía si el plan del usuario la incluye.
 *
 * Si no la incluye devuelve `null` — la ruta muestra "no encontrada", no una
 * pantalla de bloqueo. Es deliberado: el usuario no debe toparse con contenido
 * que existe pero no puede leer.
 */
export async function getGuide(guiaId: string): Promise<{ guia: GuideFull | null }> {
  const plan = await getViewerPlan();

  const { data: guia } = await supabase
    .from("clinical_guides")
    .select("*")
    .eq("id", guiaId)
    .in("min_plan", allowedPlans(plan))
    .maybeSingle();

  return { guia: (guia as GuideFull) ?? null };
}
