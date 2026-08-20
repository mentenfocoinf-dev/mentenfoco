// ============================================================================
// Contenido de la plataforma (artículos / programas / herramientas / audio).
//
// Flujo editorial: el terapeuta redacta y envía a revisión; SOLO el admin
// publica. Esa regla no depende de esta capa: la impone el trigger
// enforce_content_authorization en la base, así que sigue vigente aunque
// alguien manipule el cliente. Aquí se refleja para que la UI no ofrezca
// acciones que el servidor va a rechazar.
//
// Mientras RLS siga desactivado, el filtrado de lectura (solo `publicado` y con
// el plan suficiente) lo hace este servicio. Las policies equivalentes están
// escritas y comentadas en supabase/20260724_content_items.sql.
// ============================================================================
import { supabase, type PlanType } from "../supabase";
import { allowedPlans } from "./plans";
import { getViewerPlan } from "./guidesService";
import type { ThemeKey } from "./themes";

export type ContentType = "articulo" | "programa" | "herramienta" | "audio" | "blog";

/**
 * Los tipos que forman la biblioteca del miembro (/contenido).
 *
 * 'blog' queda fuera a propósito: desde el 29-jul, Guías, Contenido y Blog son
 * tres secciones separadas y ninguna pieza vive en dos. El tipo es lo único que
 * decide la sección — no hay marcas paralelas que puedan desincronizarse.
 */
export const LIBRARY_TYPES: ContentType[] = ["articulo", "programa", "herramienta", "audio"];
export type AudioKind = "meditacion" | "podcast";
export type ContentStatus =
  | "borrador"
  | "en_revision"
  | "cambios_solicitados"
  | "aprobado"
  | "publicado"
  | "archivado";

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  articulo: "Artículo",
  programa: "Programa",
  herramienta: "Herramienta",
  audio: "Audio",
  blog: "Blog",
};

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  borrador: "Borrador",
  en_revision: "En revisión",
  cambios_solicitados: "Cambios solicitados",
  aprobado: "Aprobado",
  publicado: "Publicado",
  archivado: "Archivado",
};

/** Clases de color por estado, para los badges del panel y de la lista del autor. */
export const CONTENT_STATUS_CLASSES: Record<ContentStatus, string> = {
  borrador: "bg-slate-100 text-slate-600 border-slate-200",
  en_revision: "bg-amber-50 text-amber-700 border-amber-200",
  cambios_solicitados: "bg-orange-50 text-orange-700 border-orange-200",
  aprobado: "bg-sky-50 text-sky-700 border-sky-200",
  publicado: "bg-emerald-50 text-emerald-700 border-emerald-200",
  archivado: "bg-slate-100 text-slate-400 border-slate-200",
};

export interface ContentFaqEntry {
  q: string;
  a: string;
}

export interface ProgramStep {
  orden: number;
  titulo: string;
  descripcion?: string;
  content_item_id?: string | null;
  /** Slug de la pieza enlazada. Puede ser de contenido o de una guía clínica. */
  slug_relacionado?: string | null;
  /** Lo resuelve el seed: dice a qué ruta apunta `slug_relacionado`. */
  ref_kind?: "contenido" | "guia" | null;
}

/** Metadatos (vista content_items_meta): nunca incluye body_md. */
export interface ContentMeta {
  id: string;
  content_type: ContentType;
  audio_kind: AudioKind | null;
  categoria: string;
  titulo: string;
  slug: string;
  resumen_breve: string;
  cover_image: string | null;
  tiempo_lectura: string | null;
  min_plan: PlanType;
  /** Solo se mira en piezas de blog: si es false, no se dibuja la caja de comentarios. */
  admite_comentarios: boolean;
  tags: string[] | null;
  status: ContentStatus;
  published_at: string | null;
  /** Eje temático interno. `null` mientras la pieza no esté clasificada. */
  theme_key: ThemeKey | null;
}

export interface ContentItem extends ContentMeta {
  /** SEO: lo fija el admin al publicar, no el autor. */
  meta_title: string | null;
  meta_description: string | null;
  body_md: string | null;
  en_resumen: string[] | null;
  faq: ContentFaqEntry[] | null;
  key_takeaway: string | null;
  clinical_refs: { fuente: string; nota?: string }[] | null;
  audio_url: string | null;
  external_embed_url: string | null;
  program_steps: ProgramStep[] | null;
  author_id: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  published_by: string | null;
  created_at: string;
  updated_at: string;
}

// ── Lectura pública / paciente ──────────────────────────────────────────────
//
// MODELO DE ACCESO (28-jul): no se muestra contenido bloqueado. El usuario ve
// completas las piezas que su plan incluye; el resto no se devuelve. `min_plan`
// sigue decidiendo desde qué plan aparece cada pieza, pero se aplica FILTRANDO,
// no bloqueando. No hay paywall en ningún camino de contenido.

/**
 * Lista las piezas publicadas que el plan del usuario incluye. Lo que no
 * incluye, no se devuelve: la UI nunca dibuja un candado.
 */
export async function listPublishedContent(type?: ContentType): Promise<ContentMeta[]> {
  const plan = await getViewerPlan();

  let query = supabase
    .from("content_items_meta")
    .select("*")
    .eq("status", "publicado")
    .in("min_plan", allowedPlans(plan))
    // El blog no es biblioteca: tiene su propia sección y sus propias reglas.
    .in("content_type", LIBRARY_TYPES);
  if (type) query = query.eq("content_type", type);

  const { data, error } = await query.order("published_at", { ascending: false });
  if (error) {
    console.error("[contentService] Error listando contenido:", error.message);
    return [];
  }
  return (data ?? []) as ContentMeta[];
}

/**
 * Trae una pieza publicada por slug si el plan del usuario la incluye.
 *
 * Si no la incluye devuelve `null` — la ruta muestra "no encontrada", no una
 * pantalla de bloqueo.
 */
export async function getContentBySlug(
  slug: string,
): Promise<{ item: ContentItem | null; reachableSteps: string[] }> {
  const plan = await getViewerPlan();

  const { data: item } = await supabase
    .from("content_items")
    .select("*")
    .eq("slug", slug)
    .eq("status", "publicado")
    .in("min_plan", allowedPlans(plan))
    // Un post de blog en /contenido/... sería la misma pieza en dos secciones.
    .in("content_type", LIBRARY_TYPES)
    .maybeSingle();

  const doc = (item as ContentItem) ?? null;
  return { item: doc, reachableSteps: await resolveReachableSteps(doc, plan) };
}

/**
 * Qué pasos de un programa puede abrir de verdad este lector.
 *
 * Un programa puede estar en un plan más bajo que las piezas a las que enlaza
 * (`programa-enfoque` es free y apunta a herramientas integral/premium). Sin
 * esto, el enlace llevaría a "no encontrado", que es justo el callejón sin
 * salida que el modelo sin candados existe para evitar. El paso se sigue
 * mostrando —título y descripción valen por sí solos—, pero como texto.
 */
async function resolveReachableSteps(item: ContentItem | null, plan: PlanType): Promise<string[]> {
  const steps = item?.program_steps;
  if (!steps || steps.length === 0) return [];

  const planes = allowedPlans(plan);
  const contenido = steps.filter((s) => s.ref_kind === "contenido" && s.slug_relacionado);
  const guias = steps.filter((s) => s.ref_kind === "guia" && s.slug_relacionado);

  const alcanzables: string[] = [];

  if (contenido.length > 0) {
    const { data } = await supabase
      .from("content_items_meta")
      .select("slug")
      .in("slug", contenido.map((s) => s.slug_relacionado as string))
      .eq("status", "publicado")
      .in("min_plan", planes);
    alcanzables.push(...(data ?? []).map((r) => r.slug as string));
  }

  if (guias.length > 0) {
    const { data } = await supabase
      .from("clinical_guides_meta")
      .select("id")
      .in("id", guias.map((s) => s.slug_relacionado as string))
      .in("min_plan", planes);
    alcanzables.push(...(data ?? []).map((r) => r.id as string));
  }

  return alcanzables;
}

// ── Blog público ────────────────────────────────────────────────────────────
//
// Sección propia, no un espejo de Contenido. Hasta el 29-jul /blog listaba los
// artículos free de la biblioteca, con lo que la misma pieza salía en dos
// secciones; ahora el blog es `content_type = 'blog'` y nada más.
//
// Estas funciones no consultan el plan del visitante a propósito: el blog es
// público por definición y es donde vive la conversación con los pacientes.

/** Posts del blog publicados. Público: no depende de la sesión. */
export async function listBlogArticles(): Promise<ContentMeta[]> {
  const { data, error } = await supabase
    .from("content_items_meta")
    .select("*")
    .eq("content_type", "blog")
    .eq("status", "publicado")
    .order("published_at", { ascending: false });

  if (error) {
    console.error("[contentService] Error listando el blog:", error.message);
    return [];
  }
  return (data ?? []) as ContentMeta[];
}

/** Un post del blog por slug. Nunca devuelve una pieza de la biblioteca. */
export async function getBlogArticleBySlug(slug: string): Promise<{ item: ContentItem | null }> {
  const { data } = await supabase
    .from("content_items")
    .select("*")
    .eq("slug", slug)
    .eq("content_type", "blog")
    .eq("status", "publicado")
    .maybeSingle();

  return { item: (data as ContentItem) ?? null };
}

// ── Autoría (terapeuta y admin) ─────────────────────────────────────────────

export async function listMyContent(authorId: string): Promise<ContentItem[]> {
  const { data, error } = await supabase
    .from("content_items")
    .select("*")
    .eq("author_id", authorId)
    .order("updated_at", { ascending: false });
  if (error) {
    console.error("[contentService] Error listando mis propuestas:", error.message);
    return [];
  }
  return (data ?? []) as ContentItem[];
}

/**
 * Campos que edita el AUTOR (terapeuta o admin).
 *
 * `slug`, `min_plan` y los meta de SEO NO están aquí a propósito: son decisiones
 * editoriales y de distribución que toma el admin al publicar. El terapeuta solo
 * escribe.
 */
export interface ContentDraftInput {
  content_type: ContentType;
  audio_kind?: AudioKind | null;
  categoria: string;
  titulo: string;
  resumen_breve: string;
  body_md?: string | null;
  tiempo_lectura?: string | null;
}

/** Campos que solo el admin fija antes de publicar. */
export interface ContentPublishSettings {
  slug: string;
  meta_title?: string | null;
  meta_description?: string | null;
  min_plan: PlanType;
}

/** Convierte un título en slug: minúsculas, sin acentos, separado por guiones. */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function translateWriteError(message: string): string {
  if (message.includes("content_items_slug_key") || message.includes("duplicate key")) {
    return "Ya existe una pieza con esa URL (slug). Cambia el título o el slug.";
  }
  if (message.includes("content_items_published_needs_slug_check")) {
    return "No se puede publicar sin una URL (slug). Defínela antes de publicar.";
  }
  return message;
}

export async function createContentDraft(
  authorId: string,
  input: ContentDraftInput,
): Promise<string> {
  const { data, error } = await supabase
    .from("content_items")
    .insert({ ...input, author_id: authorId, status: "borrador" })
    .select("id")
    .single();
  if (error) throw new Error(translateWriteError(error.message));
  return data.id as string;
}

export async function updateContentDraft(
  id: string,
  patch: Partial<ContentDraftInput>,
): Promise<void> {
  const { error } = await supabase.from("content_items").update(patch).eq("id", id);
  if (error) throw new Error(translateWriteError(error.message));
}

/** El autor envía su borrador al admin. Limpia las notas de la revisión previa. */
export async function submitForReview(id: string): Promise<void> {
  const { error } = await supabase
    .from("content_items")
    .update({ status: "en_revision", review_notes: null })
    .eq("id", id);
  if (error) throw new Error(translateWriteError(error.message));
}

// ── Panel de revisión (admin) ───────────────────────────────────────────────

export async function listReviewQueue(): Promise<ContentItem[]> {
  const { data, error } = await supabase
    .from("content_items")
    .select("*")
    .eq("status", "en_revision")
    .order("updated_at", { ascending: true });
  if (error) {
    console.error("[contentService] Error cargando la cola de revisión:", error.message);
    return [];
  }
  return (data ?? []) as ContentItem[];
}

/** Todo el contenido, para la vista de administración. */
export async function listAllContent(): Promise<ContentItem[]> {
  const { data, error } = await supabase
    .from("content_items")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) {
    console.error("[contentService] Error listando contenido:", error.message);
    return [];
  }
  return (data ?? []) as ContentItem[];
}

export async function approveContent(id: string, adminId: string): Promise<void> {
  const { error } = await supabase
    .from("content_items")
    .update({
      status: "aprobado",
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
      review_notes: null,
    })
    .eq("id", id);
  if (error) throw new Error(translateWriteError(error.message));
}

export async function requestContentChanges(
  id: string,
  adminId: string,
  notes: string,
): Promise<void> {
  const { error } = await supabase
    .from("content_items")
    .update({
      status: "cambios_solicitados",
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
      review_notes: notes.trim(),
    })
    .eq("id", id);
  if (error) throw new Error(translateWriteError(error.message));
}

/**
 * Publica una pieza. Si quien llama no es admin, el trigger de la base rechaza
 * la operación y translateWriteError devuelve el mensaje entendible.
 */
/**
 * Publica una pieza fijando, en el mismo paso, la URL, el SEO y el tier — son
 * decisiones del admin, no del autor. La base rechaza publicar sin slug
 * (content_items_published_needs_slug_check) y rechaza que publique alguien que
 * no sea admin (trigger enforce_content_authorization).
 */
export async function publishContent(
  id: string,
  adminId: string,
  settings?: ContentPublishSettings,
): Promise<void> {
  const { error } = await supabase
    .from("content_items")
    .update({
      ...(settings
        ? {
            slug: settings.slug.trim(),
            meta_title: settings.meta_title?.trim() || null,
            meta_description: settings.meta_description?.trim() || null,
            min_plan: settings.min_plan,
          }
        : {}),
      status: "publicado",
      published_by: adminId,
      published_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(translateWriteError(error.message));
}

export async function archiveContent(id: string): Promise<void> {
  const { error } = await supabase
    .from("content_items")
    .update({ status: "archivado" })
    .eq("id", id);
  if (error) throw new Error(translateWriteError(error.message));
}
