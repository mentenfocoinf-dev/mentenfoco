// ============================================================================
// Contenido de la plataforma (artículos / programas / herramientas / audio).
//
// Flujo editorial: el terapeuta redacta y envía a revisión; SOLO el admin
// publica. Esa regla no depende de esta capa: la impone el trigger
// enforce_content_publish_is_admin en la base, así que sigue vigente aunque
// alguien manipule el cliente. Aquí se refleja para que la UI no ofrezca
// acciones que el servidor va a rechazar.
//
// Mientras RLS siga desactivado, el filtrado de lectura (solo `publicado` y con
// el plan suficiente) lo hace este servicio. Las policies equivalentes están
// escritas y comentadas en supabase/20260724_content_items.sql.
// ============================================================================
import { supabase, type PlanType } from "../supabase";
import { PLAN_RANK } from "./plans";

export type ContentType = "articulo" | "programa" | "herramienta" | "audio";
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
  tags: string[] | null;
  status: ContentStatus;
  published_at: string | null;
}

export interface ContentItem extends ContentMeta {
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

/** Plan del usuario actual; `free` si no hay sesión. */
async function currentPlan(): Promise<PlanType> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "free";
  const { data } = await supabase
    .from("profiles")
    .select("plan_type")
    .eq("id", user.id)
    .maybeSingle();
  return (data?.plan_type as PlanType) ?? "free";
}

/** ¿Este plan alcanza para leer una pieza con ese `min_plan`? */
export function canReadContent(minPlan: PlanType, userPlan: PlanType): boolean {
  return PLAN_RANK[userPlan] >= PLAN_RANK[minPlan];
}

/**
 * Lista TODAS las piezas publicadas (metadatos), incluidas las que el usuario
 * todavía no puede leer — la UI las muestra con candado, igual que las guías.
 */
export async function listPublishedContent(type?: ContentType): Promise<ContentMeta[]> {
  let query = supabase.from("content_items_meta").select("*").eq("status", "publicado");
  if (type) query = query.eq("content_type", type);

  const { data, error } = await query.order("published_at", { ascending: false });
  if (error) {
    console.error("[contentService] Error listando contenido:", error.message);
    return [];
  }
  return (data ?? []) as ContentMeta[];
}

/**
 * Trae una pieza publicada por slug. Si el plan del usuario no alcanza, devuelve
 * solo los metadatos para que la UI muestre el paywall — mismo contrato que
 * getGuide().
 */
export async function getContentBySlug(
  slug: string,
): Promise<{ item: ContentItem | null; meta: ContentMeta | null }> {
  const { data: meta } = await supabase
    .from("content_items_meta")
    .select("*")
    .eq("slug", slug)
    .eq("status", "publicado")
    .maybeSingle();

  if (!meta) return { item: null, meta: null };

  const plan = await currentPlan();
  if (!canReadContent((meta as ContentMeta).min_plan, plan)) {
    return { item: null, meta: meta as ContentMeta };
  }

  const { data: item } = await supabase
    .from("content_items")
    .select("*")
    .eq("slug", slug)
    .eq("status", "publicado")
    .maybeSingle();

  return { item: (item as ContentItem) ?? null, meta: meta as ContentMeta };
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

export interface ContentDraftInput {
  content_type: ContentType;
  audio_kind?: AudioKind | null;
  categoria: string;
  titulo: string;
  slug: string;
  resumen_breve: string;
  body_md?: string | null;
  tiempo_lectura?: string | null;
  min_plan?: PlanType;
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
  if (message.includes("CONTENT_PUBLISH_FORBIDDEN")) {
    return "Solo un administrador puede publicar contenido.";
  }
  if (message.includes("content_items_slug_key") || message.includes("duplicate key")) {
    return "Ya existe una pieza con esa URL (slug). Cambia el título o el slug.";
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
export async function publishContent(id: string, adminId: string): Promise<void> {
  const { error } = await supabase
    .from("content_items")
    .update({
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
