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
}

export interface GuideFull extends GuideMeta {
  fundamentoClinico: string;
  ejercicioPractico: string;
  contenidoCompleto: string | null;
}

/** Lista todas las guías (metadatos), incluidas las que el usuario no puede leer aún. */
export async function listGuides(): Promise<GuideMeta[]> {
  const { data, error } = await supabase
    .from("clinical_guides_meta")
    .select("*")
    .order("titulo");
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

  if (guia) return { guia: guia as GuideFull, meta: null };

  const { data: meta } = await supabase
    .from("clinical_guides_meta")
    .select("*")
    .eq("id", guiaId)
    .maybeSingle();

  return { guia: null, meta: (meta as GuideMeta) ?? null };
}
