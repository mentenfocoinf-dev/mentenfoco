import { useEffect, useState } from "react";
import { ArrowLeft, MessageCircle, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { getTherapistConversations, type TherapistConversation } from "../../lib/api";
import { ChatThread } from "./ChatThread";

interface Props {
  therapistId: string;
  // Notifica al dashboard cada vez que se recarga la bandeja, para que el badge global del
  // header (fuera de esta tarjeta) se mantenga sincronizado sin duplicar la consulta.
  onConversationsChange?: (conversations: TherapistConversation[]) => void;
}

// Bandeja de mensajería del terapeuta: lista de conversaciones a la izquierda y el hilo
// abierto a la derecha, dentro del propio portal.
//
// Antes el hilo se abría en un modal a pantalla completa con el fondo oscurecido. Se
// cambió por este layout dividido porque atender a un paciente no es una interrupción:
// es la pantalla en la que el profesional está trabajando, y oscurecer el resto del
// portal cada vez que abre una conversación lo trata como si fuera un aviso puntual.
//
// En móvil no caben dos columnas, así que la conversación ocupa el ancho completo y la
// lista se oculta con un botón para volver — el mismo patrón que cualquier cliente de
// correo. Sigue sin haber overlay.
//
// La lógica de mensajería no cambia: la carga, el realtime, el envío y el marcado de
// leído siguen exactamente donde estaban.
export function TherapistMessages({ therapistId, onConversationsChange }: Props) {
  const [conversations, setConversations] = useState<TherapistConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<TherapistConversation | null>(null);

  async function load() {
    try {
      const data = await getTherapistConversations(therapistId);
      setConversations(data);
      onConversationsChange?.(data);
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

  const lista = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-white/50 px-5 py-4">
        <h2 className="flex items-center gap-2 text-base font-bold text-primary">
          <MessageCircle size={18} /> Mensajes
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Conversaciones con tus pacientes.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" /> Cargando…
          </div>
        ) : conversations.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white/40 p-4 text-sm text-muted-foreground">
            Todavía no tienes conversaciones. Cuando un paciente te escriba, aparecerá aquí.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {conversations.map((c) => {
              const abierta = active?.patient_id === c.patient_id;
              return (
                <li key={c.patient_id}>
                  <button
                    onClick={() => setActive(c)}
                    aria-current={abierta ? "true" : undefined}
                    className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors ${
                      abierta
                        ? "border-primary/40 bg-primary/10"
                        : "border-white/50 bg-white/50 hover:border-primary/40"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-bold text-slate-800">
                          {c.patient_name}
                        </p>
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
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );

  const hilo = active ? (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-white/50 px-5 py-4">
        {/* Volver: solo hace falta en móvil, donde la lista queda oculta. */}
        <button
          onClick={closeThread}
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 md:hidden"
          aria-label="Volver a la lista"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <MessageCircle size={17} />
        </div>
        <h3 className="min-w-0 flex-1 truncate text-base font-bold text-slate-900">
          {active.patient_name}
        </h3>
        <button
          onClick={closeThread}
          className="hidden rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 md:inline-flex"
        >
          Cerrar
        </button>
      </div>

      <div className="min-h-0 flex-1 p-4">
        <ChatThread
          patientId={active.patient_id}
          therapistId={therapistId}
          currentUserId={therapistId}
          otherName={active.patient_name}
          heightClass="h-[26rem]"
          onRead={load}
        />
      </div>
    </div>
  ) : (
    <div className="flex h-full items-center justify-center p-8 text-center">
      <p className="max-w-xs text-sm text-muted-foreground">
        Elige una conversación de la lista para leerla y responder.
      </p>
    </div>
  );

  return (
    <div className="card-neon-hover overflow-hidden rounded-3xl glass-card border border-white/40">
      <div className="grid min-h-[34rem] md:grid-cols-[20rem_1fr]">
        {/* En móvil, al abrir un hilo la lista se retira; en escritorio conviven. */}
        <div className={`${active ? "hidden md:block" : "block"} md:border-r md:border-white/50`}>
          {lista}
        </div>
        <div className={active ? "block" : "hidden md:block"}>{hilo}</div>
      </div>
    </div>
  );
}
