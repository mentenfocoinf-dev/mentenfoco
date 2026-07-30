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
import { PLAN_RANK } from "./plans";

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
}

export interface GuideFull extends GuideMeta {
  fundamentoClinico: string;
  ejercicioPractico: string;
  contenidoCompleto: string | null;
}

/**
 * Plan efectivo del usuario para decidir qué contenido ve.
 *
 * Terapeutas y admin obtienen el nivel máximo: necesitan ver todo el material
 * que trabajan con sus pacientes, y en la base figuran con plan_type='free'.
 * Sin sesión = 'free'.
 */
export async function getViewerPlan(): Promise<PlanType> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "free";

  const { data } = await supabase
    .from("profiles")
    .select("role, plan_type")
    .eq("id", user.id)
    .maybeSingle();

  if (!data) return "free";
  if (data.role === "admin" || data.role === "therapist") return "premium";
  return (data.plan_type as PlanType) ?? "free";
}

/** Planes cuyo contenido alcanza a ver quien tiene `plan`. */
function allowedPlans(plan: PlanType): PlanType[] {
  return (Object.keys(PLAN_RANK) as PlanType[]).filter(
    (p) => PLAN_RANK[p] <= PLAN_RANK[plan],
  );
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
