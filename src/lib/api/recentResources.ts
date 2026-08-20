// ============================================================================
// De un recurso del recorrido a algo que se pueda dibujar.
//
// `journey_recent_resources` devuelve identificador y tipo: lo mínimo que puede
// salir de la tabla de eventos. Para mostrarlo hace falta el título, la ruta y
// —si encima se van a pedir recomendaciones— el contexto que espera el motor.
//
// Esto vive aquí y no dentro de un componente porque lo necesitan al menos dos
// pantallas: la banda de continuidad de la Home y el dashboard del paciente.
// Una segunda copia sería una segunda forma de resolver la misma pregunta.
//
// Devuelve `null` cuando el recurso ya no es alcanzable —despublicado, o fuera
// de la etapa de quien mira—. Quien llama debe probar el siguiente en vez de
// ofrecer un enlace que lleva a "no encontrado".
// ============================================================================
import { getContentBySlug, getBlogArticleBySlug } from "./contentService";
import { getGuide } from "./guidesService";
import type { RecommendationContext } from "./recommendationsService";

export const RESOURCE_TYPE_LABELS: Record<string, string> = {
  guia: "Guía",
  blog: "Artículo del blog",
  articulo: "Artículo",
  herramienta: "Herramienta",
  audio: "Audio",
  programa: "Programa",
};

export interface ResolvedRecentResource {
  id: string;
  titulo: string;
  descripcion: string;
  /** Ruta ya resuelta: quien la usa no construye URLs. */
  href: string;
  /** Nombre legible del tipo. */
  etiqueta: string;
  /** Contexto listo para el Recommendation Engine, sin volver a consultar. */
  contexto: RecommendationContext;
}

export function rutaDeRecurso(tipo: string, id: string): string {
  if (tipo === "guia") return `/guias/${id}`;
  if (tipo === "blog") return `/blog/${id}`;
  return `/contenido/${id}`;
}

export async function resolveRecentResource(
  id: string,
  tipo: string,
): Promise<ResolvedRecentResource | null> {
  const etiqueta = RESOURCE_TYPE_LABELS[tipo] ?? "Recurso";
  const href = rutaDeRecurso(tipo, id);

  if (tipo === "guia") {
    const { guia } = await getGuide(id);
    if (!guia) return null;
    return {
      id,
      titulo: guia.titulo,
      descripcion: guia.descripcionBreve ?? "",
      href,
      etiqueta,
      contexto: {
        source: "guia",
        currentId: id,
        categoria: guia.categoria,
        tipoActual: "guia",
        themeKey: guia.theme_key,
        tags: guia.etiquetas,
      },
    };
  }

  const { item } = tipo === "blog" ? await getBlogArticleBySlug(id) : await getContentBySlug(id);
  if (!item) return null;

  return {
    id,
    titulo: item.titulo,
    descripcion: item.resumen_breve ?? "",
    href,
    etiqueta,
    contexto: {
      source: tipo === "blog" ? "blog" : "contenido",
      currentId: item.slug ?? id,
      categoria: item.categoria,
      tipoActual: item.content_type,
      themeKey: item.theme_key,
      tags: item.tags,
    },
  };
}
