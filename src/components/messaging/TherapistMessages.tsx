import { useEffect, useState } from "react";
import { MessageCircle, Loader2, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { getTherapistConversations, type TherapistConversation } from "../../lib/api";
import { ChatThread } from "./ChatThread";

// Bandeja de mensajería del terapeuta: lista de conversaciones (último mensaje + no leídos)
// y, al abrir una, el hilo en un modal.
export function TherapistMessages({ therapistId }: { therapistId: string }) {
  const [conversations, setConversations] = useState<TherapistConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<TherapistConversation | null>(null);

  async function load() {
    try {
      setConversations(await getTherapistConversations(therapistId));
    } catch (err) {
      console.error("[TherapistMessages] Error cargando conversaciones:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // Realtime: al llegar un mensaje nuevo para este terapeuta, refrescamos la bandeja
    // (último mensaje y contador de no leídos).
    const channel = supabase
      .channel(`therapist_inbox_${therapistId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `therapist_id=eq.${therapistId}`,
        },
        () => {
          load();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [therapistId]);

  function closeThread() {
    setActive(null);
    load(); // refrescar no leídos tras leer/responder
  }

  return (
    <div className="card-neon-hover rounded-3xl glass-card p-6 border border-white/40">
      <h2 className="text-lg font-bold text-primary mb-1 flex items-center gap-2">
        <MessageCircle size={20} /> Mensajes
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Conversaciones con tus pacientes. Abre una para leer y responder.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> Cargando...
        </div>
      ) : conversations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/40 p-4">
          <p className="text-sm text-muted-foreground">
            Todavía no tienes conversaciones. Cuando un paciente te escriba, aparecerá aquí.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {conversations.map((c) => (
            <li key={c.patient_id}>
              <button
                onClick={() => setActive(c)}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/50 bg-white/50 p-4 text-left transition-colors hover:border-primary/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-bold text-slate-800">{c.patient_name}</p>
                    {c.unread_count > 0 && (
                      <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                        {c.unread_count}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{c.last_message}</p>
                </div>
                <span className="shrink-0 text-[10px] text-slate-400">
                  {new Date(c.last_message_at).toLocaleDateString()}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {active && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative flex w-full max-w-xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <MessageCircle size={20} />
                </div>
                <h3 className="text-base font-bold text-slate-900">{active.patient_name}</h3>
              </div>
              <button
                onClick={closeThread}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <ChatThread
                patientId={active.patient_id}
                therapistId={therapistId}
                currentUserId={therapistId}
                otherName={active.patient_name}
                heightClass="h-96"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
