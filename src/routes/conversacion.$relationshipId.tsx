// ============================================================================
// Conversación privada paciente ↔ terapeuta.
//
// Texto plano y nada más: sin emojis, sin markdown, sin adjuntos, sin editar y
// sin borrar. Lo que se escribe queda tal cual y se queda.
//
// Quién puede leerla y quién puede escribir lo decide la base. Si esta pantalla
// se abre con el identificador de una conversación ajena, el servicio devuelve
// vacío y aquí solo se puede decir que no está disponible — no hay forma de
// distinguir "no existe" de "no es tuya", y así debe ser.
// ============================================================================
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, CheckCheck, Loader2, Send } from "lucide-react";
import { supabase } from "../lib/supabase";
import { SolicitarCita } from "../components/agenda/SolicitarCita";
import {
  getConversation,
  markAsRead,
  sendMessage,
  type ConversationMessage,
  type Relationship,
} from "../lib/api";

export const Route = createFileRoute("/conversacion/$relationshipId")({
  head: () => ({
    meta: [{ title: "Conversación — Mente en Foco" }, { name: "robots", content: "noindex" }],
  }),
  component: Conversacion,
});

function hora(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Conversacion() {
  const { relationshipId } = Route.useParams();

  const [relacion, setRelacion] = useState<Relationship | null>(null);
  const [mensajes, setMensajes] = useState<ConversationMessage[]>([]);
  const [yo, setYo] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finRef = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async () => {
    const { relationship, messages } = await getConversation(relationshipId);
    setRelacion(relationship);
    setMensajes(messages);
    setCargando(false);
    // Al abrirla, lo recibido queda leído. Si falla, no se le cuenta a nadie.
    if (relationship) void markAsRead(relationshipId).catch(() => {});
  }, [relationshipId]);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setYo(data.session?.user?.id ?? null));
    void cargar();
  }, [cargar]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;

    setEnviando(true);
    setError(null);
    try {
      await sendMessage(relationshipId, texto);
      setTexto("");
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el mensaje.");
    } finally {
      setEnviando(false);
    }
  }

  if (cargando) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={26} />
      </div>
    );
  }

  if (!relacion) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Conversación no disponible</h1>
        <p className="mt-2 text-sm text-muted-foreground">No existe o no formas parte de ella.</p>
        <Link
          to="/ingresa"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
        >
          <ArrowLeft size={15} /> Volver al portal
        </Link>
      </section>
    );
  }

  const cerrada = relacion.status !== "active";

  return (
    <section className="mx-auto flex min-h-[80vh] max-w-3xl flex-col px-4 py-8 md:px-6">
      <Link
        to="/ingresa"
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-primary"
      >
        <ArrowLeft size={15} /> Volver al portal
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-primary">Conversación</h1>
        {/* Único acceso para pedir cita: no se duplica en otra pantalla. */}
        {!cerrada && <SolicitarCita relationshipId={relationshipId} />}
      </div>

      <ul className="mt-6 flex-1 space-y-3">
        {mensajes.length === 0 && (
          <li className="text-sm text-muted-foreground">
            Todavía no hay mensajes. Escribe el primero.
          </li>
        )}

        {mensajes.map((m) => {
          const mio = m.senderId === yo;
          return (
            <li key={m.id} className={`flex ${mio ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  mio ? "bg-primary text-primary-foreground" : "border border-slate-200 bg-white"
                }`}
              >
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {m.message}
                </p>
                <p
                  className={`mt-1.5 flex items-center gap-1 text-[11px] ${
                    mio ? "text-primary-foreground/70" : "text-slate-400"
                  }`}
                >
                  {mio ? "Tú" : "Recibido"} · {hora(m.createdAt)}
                  {mio &&
                    (m.readAt ? (
                      <>
                        <CheckCheck size={12} /> Leído
                      </>
                    ) : (
                      <>
                        <Check size={12} /> Enviado
                      </>
                    ))}
                </p>
              </div>
            </li>
          );
        })}
        <div ref={finRef} />
      </ul>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {cerrada ? (
        <p className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Esta conversación está cerrada. Puedes leerla, pero ya no se pueden enviar mensajes.
        </p>
      ) : (
        <form onSubmit={enviar} className="mt-6 flex items-end gap-2">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={2}
            maxLength={4000}
            placeholder="Escribe tu mensaje"
            className="flex-1 resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={enviando || !texto.trim()}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            <Send size={15} /> {enviando ? "Enviando…" : "Enviar"}
          </button>
        </form>
      )}
    </section>
  );
}
