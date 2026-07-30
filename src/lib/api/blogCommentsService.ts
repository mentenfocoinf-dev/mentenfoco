// ============================================================================
// Comentarios del blog.
//
// Moderación previa, no posterior: un comentario nace 'pendiente' y solo un
// admin —o el terapeuta autor del post— lo aprueba. Esa regla NO vive aquí: la
// impone el trigger enforce_blog_comment_moderation en la base, así que sigue
// en pie aunque alguien llame a la API directamente. Esta capa solo evita
// ofrecer acciones que el servidor va a rechazar.
//
// Mientras RLS siga desactivado, el filtrado de LECTURA lo hace este servicio:
// el público ve 'aprobado'; el autor ve además los suyos en 'pendiente'. Las
// policies equivalentes están escritas y comentadas en la migración.
// ============================================================================
import { supabase } from "../supabase";

export type CommentStatus = "pendiente" | "aprobado" | "rechazado";

export const COMMENT_STATUS_LABELS: Record<CommentStatus, string> = {
  pendiente: "En revisión",
  aprobado: "Publicado",
  rechazado: "Rechazado",
};

export const COMMENT_STATUS_CLASSES: Record<CommentStatus, string> = {
  pendiente: "bg-amber-50 text-amber-700 border-amber-200",
  aprobado: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rechazado: "bg-slate-100 text-slate-500 border-slate-200",
};

export interface BlogComment {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  status: CommentStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  /** Del join con profiles; puede faltar si el perfil fue borrado. */
  author_name: string | null;
}

/** Fila cruda del select con el join anidado a profiles. */
interface CommentRow extends Omit<BlogComment, "author_name"> {
  profiles: { full_name: string | null } | null;
}

const SELECT_WITH_AUTHOR =
  "id, post_id, author_id, body, status, reviewed_by, reviewed_at, created_at, profiles!blog_comments_author_id_fkey(full_name)";

function toComment(row: CommentRow): BlogComment {
  return {
    id: row.id,
    post_id: row.post_id,
    author_id: row.author_id,
    body: row.body,
    status: row.status,
    reviewed_by: row.reviewed_by,
    reviewed_at: row.reviewed_at,
    created_at: row.created_at,
    author_name: row.profiles?.full_name ?? null,
  };
}

/**
 * Comentarios visibles de un post: los aprobados, más los propios del lector
 * aunque sigan en revisión —para que sepa que su aporte llegó y no lo escriba
 * dos veces.
 */
export async function listPostComments(
  postId: string,
): Promise<{ aprobados: BlogComment[]; mios: BlogComment[] }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("blog_comments")
    .select(SELECT_WITH_AUTHOR)
    .eq("post_id", postId)
    .eq("status", "aprobado")
    .order("created_at", { ascending: true });

  if (error) console.error("[blogComments] Error listando aprobados:", error.message);
  const aprobados = ((data ?? []) as unknown as CommentRow[]).map(toComment);

  if (!user) return { aprobados, mios: [] };

  // Solo los propios que aún no son públicos: los aprobados ya vienen arriba.
  const { data: propios } = await supabase
    .from("blog_comments")
    .select(SELECT_WITH_AUTHOR)
    .eq("post_id", postId)
    .eq("author_id", user.id)
    .neq("status", "aprobado")
    .order("created_at", { ascending: true });

  return { aprobados, mios: ((propios ?? []) as unknown as CommentRow[]).map(toComment) };
}

/**
 * Publica un comentario en revisión. No acepta `status`: el estado inicial lo
 * fija la base y el trigger rechaza cualquier intento de nacer aprobado.
 */
export async function submitComment(postId: string, authorId: string, body: string): Promise<void> {
  const texto = body.trim();
  if (!texto) throw new Error("El comentario está vacío.");

  const { error } = await supabase
    .from("blog_comments")
    .insert({ post_id: postId, author_id: authorId, body: texto });

  if (error) throw new Error(traducirError(error.message));
}

// ── Moderación ──────────────────────────────────────────────────────────────

export interface ModerationComment extends BlogComment {
  post_slug: string;
  post_titulo: string;
}

interface ModerationRow extends CommentRow {
  content_items: { slug: string | null; titulo: string } | null;
}

/**
 * Cola de moderación. `postAuthorId` la acota a los posts de un terapeuta —él
 * modera su propia conversación, no la de los demás.
 */
export async function listCommentQueue(
  status: CommentStatus = "pendiente",
  postAuthorId?: string,
): Promise<ModerationComment[]> {
  const { data, error } = await supabase
    .from("blog_comments")
    .select(`${SELECT_WITH_AUTHOR}, content_items!inner(slug, titulo, author_id)`)
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[blogComments] Error cargando la cola:", error.message);
    return [];
  }

  let filas = (data ?? []) as unknown as (ModerationRow & {
    content_items: { slug: string | null; titulo: string; author_id: string } | null;
  })[];
  if (postAuthorId) filas = filas.filter((f) => f.content_items?.author_id === postAuthorId);

  return filas.map((f) => ({
    ...toComment(f),
    post_slug: f.content_items?.slug ?? "",
    post_titulo: f.content_items?.titulo ?? "(post eliminado)",
  }));
}

/** Aprueba o rechaza. El trigger vuelve a comprobar quién es el que modera. */
export async function moderateComment(
  id: string,
  moderatorId: string,
  decision: "aprobado" | "rechazado",
): Promise<void> {
  const { error } = await supabase
    .from("blog_comments")
    .update({ status: decision, reviewed_by: moderatorId, reviewed_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(traducirError(error.message));
}

/** Cuántos esperan revisión, para el badge del panel. */
export async function countPendingComments(postAuthorId?: string): Promise<number> {
  if (postAuthorId) return (await listCommentQueue("pendiente", postAuthorId)).length;

  const { count, error } = await supabase
    .from("blog_comments")
    .select("id", { count: "exact", head: true })
    .eq("status", "pendiente");

  if (error) return 0;
  return count ?? 0;
}

/** Los errores del trigger son códigos; el usuario merece una frase. */
function traducirError(mensaje: string): string {
  if (mensaje.includes("BLOG_COMMENT_CLOSED")) return "Este post no admite comentarios.";
  if (mensaje.includes("BLOG_COMMENT_SELF_PUBLISH_FORBIDDEN"))
    return "Los comentarios pasan por revisión antes de publicarse.";
  if (mensaje.includes("BLOG_COMMENT_MODERATION_FORBIDDEN"))
    return "No tienes permiso para moderar este comentario.";
  if (mensaje.includes("BLOG_COMMENT_AUTHOR_MISMATCH"))
    return "No se puede comentar en nombre de otra persona.";
  if (mensaje.includes("BLOG_COMMENT_IMMUTABLE"))
    return "Un comentario ya publicado no se puede editar.";
  if (mensaje.includes("BLOG_COMMENT_TARGET_INVALID"))
    return "Solo se puede comentar en publicaciones del blog.";
  return mensaje;
}
