// ============================================================================
// Servicio de guías clínicas.
// - El listado usa la vista clinical_guides_meta: expone SOLO metadatos
//   (título, imagen, plan requerido), nunca el contenido clínico. Así las
//   guías bloqueadas también aparecen en el hub con su candado.
// - El contenido completo sigue protegido por RLS según el plan del usuario.
// ============================================================================
import { supabase, type PlanType } from "../supabase";

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

/**
 * ¿El usuario actual es una cuenta gratuita de captura de leads?
 *
 * Se exige role='patient' además de plan_type='free' a propósito: admin@ y
 * terapeuta@ también tienen plan_type='free' en la base, y filtrarlos por plan
 * les escondería el catálogo completo.
 *
 * Mientras RLS siga desactivado, este filtro es la única barrera real — por eso
 * vive en el servicio y no solo en la UI. La policy equivalente está escrita y
 * comentada en supabase/20260720_signup_gratis.sql para la fase de seguridad.
 */
async function isFreeLeadAccount(): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return true; // visitante anónimo: solo vitrina

  const { data } = await supabase
    .from("profiles")
    .select("role, plan_type")
    .eq("id", user.id)
    .maybeSingle();

  return data?.role === "patient" && data?.plan_type === "free";
}

export interface GuideFull extends GuideMeta {
  fundamentoClinico: string;
  ejercicioPractico: string;
  contenidoCompleto: string | null;
}

/**
 * Lista las guías (metadatos), incluidas las que el usuario no puede leer aún.
 * Las cuentas gratuitas de captura de leads solo ven la vitrina curada.
 */
export async function listGuides(): Promise<GuideMeta[]> {
  const freeLead = await isFreeLeadAccount();

  let query = supabase.from("clinical_guides_meta").select("*");
  if (freeLead) query = query.eq("visible_en_plan_gratis", true);

  const { data, error } = await query.order("titulo");
  if (error) {
    console.error("[guidesService] Error listando guías:", error.message);
    return [];
  }
  return (data ?? []) as GuideMeta[];
}

/**
 * Obtiene una guía. Si RLS bloquea el contenido (plan insuficiente),
 * devuelve solo los metadatos para poder mostrar el paywall con el
 * plan requerido.
 */
export async function getGuide(
  guiaId: string,
): Promise<{ guia: GuideFull | null; meta: GuideMeta | null }> {
  const { data: guia } = await supabase
    .from("clinical_guides")
    .select("*")
    .eq("id", guiaId)
    .maybeSingle();

  // Con RLS desactivado la consulta anterior devuelve el contenido de cualquier
  // guía, así que la cuenta gratuita se filtra aquí: si la guía no es de la
  // vitrina, se degrada a solo metadatos y la UI muestra el paywall.
  if (guia && !(guia as GuideFull).visible_en_plan_gratis && (await isFreeLeadAccount())) {
    const { data: meta } = await supabase
      .from("clinical_guides_meta")
      .select("*")
      .eq("id", guiaId)
      .maybeSingle();
    return { guia: null, meta: (meta as GuideMeta) ?? null };
  }

  if (guia) return { guia: guia as GuideFull, meta: null };

  const { data: meta } = await supabase
    .from("clinical_guides_meta")
    .select("*")
    .eq("id", guiaId)
    .maybeSingle();

  return { guia: null, meta: (meta as GuideMeta) ?? null };
}
