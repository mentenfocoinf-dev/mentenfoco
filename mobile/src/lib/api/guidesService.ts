// Guías clínicas. Idéntico a src/lib/api/guidesService.ts de la web.
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

export async function listGuides(): Promise<GuideMeta[]> {
  const { data, error } = await supabase.from("clinical_guides_meta").select("*").order("titulo");
  if (error) {
    console.error("[guidesService] Error listando guías:", error.message);
    return [];
  }
  return (data ?? []) as GuideMeta[];
}

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
