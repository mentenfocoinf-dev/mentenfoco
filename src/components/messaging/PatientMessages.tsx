import { useEffect, useState } from "react";
import { MessageCircle, Loader2 } from "lucide-react";
import { getAssignedTherapistId } from "../../lib/api";
import { ChatThread } from "./ChatThread";

// Tarjeta de mensajería para el dashboard del paciente. Resuelve el terapeuta asignado
// y muestra el hilo; si aún no hay terapeuta, muestra un estado vacío claro.
export function PatientMessages({
  patientId,
  onRead,
}: {
  patientId: string;
  // Se propaga al hilo para que el badge de no leídos del header vuelva a cero cuando el chat
  // marca los mensajes entrantes como leídos.
  onRead?: () => void;
}) {
  const [therapistId, setTherapistId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAssignedTherapistId(patientId)
      .then((id) => {
        if (!cancelled) setTherapistId(id);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  return (
    <div className="card-neon-hover rounded-3xl glass-card p-6 border border-white/40">
      <h2 className="text-lg font-bold text-primary mb-1 flex items-center gap-2">
        <MessageCircle size={20} /> Mensajes con tu terapeuta
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Escríbele a tu terapeuta entre sesiones. Los mensajes quedan guardados en tu historial.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> Cargando...
        </div>
      ) : therapistId ? (
        <ChatThread
          patientId={patientId}
          therapistId={therapistId}
          currentUserId={patientId}
          otherName="tu terapeuta"
          onRead={onRead}
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/40 p-4">
          <p className="text-sm text-muted-foreground">
            Aún no tienes un terapeuta asignado. Cuando te asignen uno, podrás escribirle aquí.
          </p>
        </div>
      )}
    </div>
  );
}
