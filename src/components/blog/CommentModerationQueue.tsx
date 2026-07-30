// ============================================================================
// Cola de moderación de comentarios del blog.
//
// La usan el admin (toda la cola) y el terapeuta (solo los posts que él firmó,
// pasando `postAuthorId`). Quién puede aprobar de verdad no lo decide este
// componente: el trigger enforce_blog_comment_moderation vuelve a comprobarlo
// en la base, así que un terapeuta no modera la conversación ajena ni llamando
// a la API directamente.
//
// La cola arranca en 'pendiente' —es lo que exige atención—, pero deja ver lo
// ya resuelto: una decisión de moderación tiene que poder revisarse.
// ============================================================================
import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, MessageCircle, X } from "lucide-react";
import {
  listCommentQueue,
  moderateComment,
  COMMENT_STATUS_LABELS,
  COMMENT_STATUS_CLASSES,
  type CommentStatus,
  type ModerationComment,
} from "../../lib/api";

interface Props {
  moderatorId: string;
  /** Presente = terapeuta: solo modera los comentarios de sus propios posts. */
  postAuthorId?: string;
  onFeedback?: (tipo: "ok" | "error", mensaje: string) => void;
}

const FILTROS: { key: CommentStatus; label: string }[] = [
  { key: "pendiente", label: "En revisión" },
  { key: "aprobado", label: "Publicados" },
  { key: "rechazado", label: "Rechazados" },
];

export function CommentModerationQueue({ moderatorId, postAuthorId, onFeedback }: Props) {
  const [filtro, setFiltro] = useState<CommentStatus>("pendiente");
  const [comentarios, setComentarios] = useState<ModerationComment[]>([]);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    setCargando(true);
    setComentarios(await listCommentQueue(filtro, postAuthorId));
    setCargando(false);
  }, [filtro, postAuthorId]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  async function decidir(c: ModerationComment, decision: "aprobado" | "rechazado") {
    setOcupado(c.id);
    try {
      await moderateComment(c.id, moderatorId, decision);
      onFeedback?.(
        "ok",
        decision === "aprobado" ? "Comentario publicado." : "Comentario rechazado.",
      );
      await recargar();
    } catch (err) {
      onFeedback?.("error", err instanceof Error ? err.message : "No se pudo moderar.");
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MessageCircle size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Comentarios del blog</h2>
            <p className="text-xs text-slate-500">
              {postAuthorId
                ? "Los aportes de los pacientes en tus publicaciones."
                : "Nada se publica sin pasar por aquí."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTROS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              className={`rounded-lg px-3.5 py-2 text-xs font-bold transition-colors ${
                filtro === f.key
                  ? "bg-primary text-primary-foreground"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {cargando ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-primary" size={22} />
        </div>
      ) : comentarios.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center">
          <p className="text-sm text-slate-500">
            {filtro === "pendiente"
              ? "No hay comentarios esperando revisión."
              : `No hay comentarios en "${COMMENT_STATUS_LABELS[filtro].toLowerCase()}".`}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {comentarios.map((c) => (
            <li key={c.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-bold text-slate-800">
                  {c.author_name ?? "Paciente sin nombre"}
                </span>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${COMMENT_STATUS_CLASSES[c.status]}`}
                >
                  {COMMENT_STATUS_LABELS[c.status]}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                En <span className="font-semibold">{c.post_titulo}</span> ·{" "}
                {new Date(c.created_at).toLocaleDateString("es-CO", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <p className="mt-3 whitespace-pre-line rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
                {c.body}
              </p>

              {c.status === "pendiente" && (
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={() => void decidir(c, "aprobado")}
                    disabled={ocupado === c.id}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {ocupado === c.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Check size={14} />
                    )}
                    Publicar
                  </button>
                  <button
                    onClick={() => void decidir(c, "rechazado")}
                    disabled={ocupado === c.id}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
                  >
                    <X size={14} /> Rechazar
                  </button>
                </div>
              )}

              {c.status !== "pendiente" && c.reviewed_at && (
                <p className="mt-3 text-xs text-slate-400">
                  Revisado el{" "}
                  {new Date(c.reviewed_at).toLocaleDateString("es-CO", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
