// ============================================================================
// Conversación de un post del blog.
//
// El blog es el único espacio de la plataforma donde los pacientes se hablan
// entre ellos: aportan lo que a cada uno le funcionó. Por eso todo pasa por
// moderación antes de ser público — en salud mental, un consejo bienintencionado
// puede hacer daño, y alguien tiene que leerlo antes que el resto.
//
// La barrera no está aquí: el trigger enforce_blog_comment_moderation rechaza
// cualquier comentario que intente nacer aprobado. Esta pantalla solo se ocupa
// de que la espera se entienda y no se sienta como un error.
// ============================================================================
import { useEffect, useState } from "react";
import { Loader2, MessageCircle, Send, ShieldCheck } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "../../hooks/useAuth";
import {
  listPostComments,
  submitComment,
  COMMENT_STATUS_LABELS,
  type BlogComment,
} from "../../lib/api";

interface Props {
  postId: string;
  /** Frontmatter del post: un post puede cerrar su conversación. */
  admiteComentarios: boolean;
}

export function BlogComments({ postId, admiteComentarios }: Props) {
  const { profile, loading: authLoading } = useAuth();
  const [aprobados, setAprobados] = useState<BlogComment[]>([]);
  const [mios, setMios] = useState<BlogComment[]>([]);
  const [cargando, setCargando] = useState(true);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    listPostComments(postId)
      .then((r) => {
        if (!vigente) return;
        setAprobados(r.aprobados);
        setMios(r.mios);
      })
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
    // profile cambia al iniciar sesión: entonces aparecen "los míos".
  }, [postId, profile?.id]);

  if (!admiteComentarios) return null;

  async function enviar() {
    if (!profile) return;
    setEnviando(true);
    setErrorMsg(null);
    setOkMsg(null);
    try {
      await submitComment(postId, profile.id, texto);
      setTexto("");
      setOkMsg("Tu comentario fue enviado y se publicará tras revisión.");
      const r = await listPostComments(postId);
      setAprobados(r.aprobados);
      setMios(r.mios);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "No pudimos enviar tu comentario.");
    } finally {
      setEnviando(false);
    }
  }

  // Solo los pacientes conversan aquí: el terapeuta ya se expresó en el post, y
  // el admin modera. Mezclar los roles en el hilo cambiaría lo que es el espacio.
  const puedeComentar = profile?.role === "patient";

  return (
    <section className="mt-16 border-t border-slate-200 pt-10">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <MessageCircle size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Lo que cuenta la comunidad</h2>
          <p className="text-sm text-slate-500">
            {aprobados.length === 0
              ? "Todavía no hay aportes publicados."
              : `${aprobados.length} ${aprobados.length === 1 ? "aporte" : "aportes"} de personas que pasaron por esto.`}
          </p>
        </div>
      </div>

      {cargando ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-primary" size={24} />
        </div>
      ) : (
        <ul className="space-y-4">
          {aprobados.map((c) => (
            <li key={c.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-bold text-slate-800">
                  {c.author_name ?? "Alguien de la comunidad"}
                </span>
                <span className="shrink-0 text-xs text-slate-400">
                  {formatearFecha(c.created_at)}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                {c.body}
              </p>
            </li>
          ))}

          {mios.map((c) => (
            <li
              key={c.id}
              className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 p-5"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-bold text-slate-800">Tu aporte</span>
                <span className="shrink-0 rounded-full border border-amber-200 bg-white px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                  {COMMENT_STATUS_LABELS[c.status]}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                {c.body}
              </p>
              {c.status === "pendiente" && (
                <p className="mt-3 text-xs text-amber-700">
                  Solo tú lo ves por ahora. Lo revisamos antes de publicarlo.
                </p>
              )}
              {c.status === "rechazado" && (
                <p className="mt-3 text-xs text-slate-500">
                  Este aporte no se publicó. Si crees que fue un error, escríbenos.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* ── Caja para escribir ─────────────────────────────────────────────── */}
      {!authLoading && (
        <div className="mt-8">
          {puedeComentar ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <label htmlFor="comentario" className="text-sm font-bold text-slate-900">
                Comparte lo que a ti te ayudó
              </label>
              <p className="mt-1 text-xs text-slate-500">
                Tu experiencia le puede servir a alguien que está empezando. Evita datos personales.
              </p>
              <textarea
                id="comentario"
                rows={4}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="A mí me sirvió…"
                className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-primary focus:outline-none"
              />

              {errorMsg && (
                <p role="alert" className="mt-3 text-sm text-red-600">
                  {errorMsg}
                </p>
              )}
              {okMsg && <p className="mt-3 text-sm text-emerald-700">{okMsg}</p>}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                  <ShieldCheck size={13} /> Se publica tras revisión de nuestro equipo.
                </span>
                <button
                  onClick={() => void enviar()}
                  disabled={!texto.trim() || enviando}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90 disabled:opacity-60"
                >
                  {enviando ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  Enviar aporte
                </button>
              </div>
            </div>
          ) : !profile ? (
            <div className="rounded-2xl border border-primary/15 bg-primary/5 p-6 text-center">
              <p className="text-sm text-slate-600">
                ¿Quieres aportar tu experiencia? Entra a tu cuenta para escribir.
              </p>
              <Link
                to="/ingresa"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Ingresar
              </Link>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
