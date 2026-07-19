import { useEffect, useRef, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import {
  getConversation,
  sendMessage,
  markConversationAsRead,
  type Message,
} from "../../lib/api";

interface Props {
  patientId: string;
  therapistId: string;
  currentUserId: string;
  // Nombre del interlocutor (para el vacío/placeholder), opcional.
  otherName?: string;
  heightClass?: string;
  // Se dispara cuando el hilo marca como leídos los mensajes entrantes. Sirve para que el badge
  // de no leídos del dashboard se ponga en cero: sin esto el contador queda "fantasma", mostrando
  // mensajes que este mismo hilo ya marcó como leídos.
  onRead?: () => void;
}

// Hilo de conversación reutilizable (paciente o terapeuta). La conversación es el par
// (patientId, therapistId); currentUserId define qué lado se alinea a la derecha.
export function ChatThread({
  patientId,
  therapistId,
  currentUserId,
  otherName,
  heightClass = "h-80",
  onRead,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Guardamos onRead en un ref: si lo pusiéramos en las dependencias del efecto, un callback
  // inline del padre recrearía la suscripción de realtime en cada render.
  const onReadRef = useRef(onRead);
  useEffect(() => {
    onReadRef.current = onRead;
  }, [onRead]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        const data = await getConversation(patientId, therapistId);
        if (cancelled) return;
        setMessages(data);
        markConversationAsRead(patientId, therapistId, currentUserId)
          .then(() => onReadRef.current?.())
          .catch(() => {});
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();

    // Realtime: mensajes nuevos de esta conversación (filtramos por paciente y validamos terapeuta).
    const channel = supabase
      .channel(`messages_${patientId}_${therapistId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `patient_id=eq.${patientId}`,
        },
        (payload) => {
          const m = payload.new as Message;
          if (m.therapist_id !== therapistId) return;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.sender_id !== currentUserId) {
            markConversationAsRead(patientId, therapistId, currentUserId)
              .then(() => onReadRef.current?.())
              .catch(() => {});
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [patientId, therapistId, currentUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const msg = await sendMessage({ patientId, therapistId, senderId: currentUserId, body });
      setMessages((prev) => (prev.some((x) => x.id === msg.id) ? prev : [...prev, msg]));
      setDraft("");
    } catch (err) {
      console.error("[ChatThread] Error enviando mensaje:", err);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col rounded-2xl border border-white/50 bg-white/40 overflow-hidden">
      <div className={`flex-1 overflow-y-auto p-4 space-y-3 ${heightClass}`}>
        {loading ? (
          <div className="flex h-full items-center justify-center text-slate-400">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center px-4">
            <p className="text-sm text-muted-foreground">
              Todavía no hay mensajes{otherName ? ` con ${otherName}` : ""}. Escribe el primero.
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === currentUserId;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                    mine
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-white text-slate-800 border border-slate-200 rounded-bl-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p
                    className={`mt-1 text-[10px] ${
                      mine ? "text-primary-foreground/70" : "text-slate-400"
                    }`}
                  >
                    {new Date(m.created_at).toLocaleString([], {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 border-t border-white/50 bg-white/60 p-3"
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Escribe un mensaje..."
          className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Enviar"
        >
          {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </form>
    </div>
  );
}
