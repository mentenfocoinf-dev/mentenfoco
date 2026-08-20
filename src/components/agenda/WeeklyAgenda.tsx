import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Video } from "lucide-react";
import type { SessionStatus } from "../../lib/api";

export interface AgendaItem {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: SessionStatus;
  label: string;
  video_call_link?: string | null;
}

interface Props {
  items: AgendaItem[];
  /**
   * Semana a mostrar. Si viene, el componente deja de navegar por su cuenta:
   * manda quien lo monta. Sin ella conserva sus propios controles, que es como
   * lo usa el panel del paciente.
   */
  semanaDe?: Date;
  /** Pinchar un día lo abre en la vista de día de quien lo monta. */
  onElegirDia?: (dia: Date) => void;
}

const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const STATUS_STYLES: Record<SessionStatus, string> = {
  programada: "border-primary/30 bg-primary/10 text-primary",
  confirmada: "border-emerald-300 bg-emerald-50 text-emerald-700",
  completada: "border-slate-200 bg-slate-100 text-slate-500",
  cancelada: "border-red-200 bg-red-50 text-red-400 line-through",
  no_asistio: "border-amber-300 bg-amber-50 text-amber-700",
};

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = domingo
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Vista semanal reutilizable (paciente o terapeuta) sobre la agenda ya verificada
// (therapy_sessions). Solo lectura + navegación entre semanas — la edición sigue viviendo
// en la lista/formulario existente de cada dashboard.
export function WeeklyAgenda({ items, semanaDe, onElegirDia }: Props) {
  const [weekStartPropio, setWeekStart] = useState(() => startOfWeek(new Date()));
  const controlado = semanaDe !== undefined;
  const weekStart = controlado ? startOfWeek(semanaDe) : weekStartPropio;

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const itemsByDay = useMemo(() => {
    return days.map((day) =>
      items
        .filter((item) => sameDay(new Date(item.scheduled_at), day))
        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()),
    );
  }, [items, days]);

  const today = new Date();
  const rangeLabel = `${days[0].toLocaleDateString([], { day: "numeric", month: "short" })} – ${days[6].toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}`;

  function goToWeek(offsetDays: number) {
    setWeekStart((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + offsetDays);
      return next;
    });
  }

  return (
    <div>
      {/* Cuando la semana la manda quien monta el componente, estos controles
          serían un segundo juego de flechas para lo mismo. */}
      {!controlado && (
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={() => goToWeek(-7)}
            className="rounded-lg border border-white/50 bg-white/50 p-2 text-primary hover:bg-white/70 transition-colors"
            aria-label="Semana anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex flex-col items-center">
            <span className="text-sm font-bold text-primary">{rangeLabel}</span>
            <button
              onClick={() => setWeekStart(startOfWeek(new Date()))}
              className="text-[11px] font-semibold text-muted-foreground hover:text-primary transition-colors"
            >
              Volver a hoy
            </button>
          </div>
          <button
            onClick={() => goToWeek(7)}
            className="rounded-lg border border-white/50 bg-white/50 p-2 text-primary hover:bg-white/70 transition-colors"
            aria-label="Semana siguiente"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
        {days.map((day, i) => (
          <div
            key={day.toISOString()}
            onClick={onElegirDia ? () => onElegirDia(day) : undefined}
            className={`rounded-2xl border p-2 ${
              sameDay(day, today) ? "border-primary/40 bg-primary/5" : "border-white/50 bg-white/40"
            } ${onElegirDia ? "cursor-pointer transition-colors hover:border-primary/40" : ""}`}
          >
            <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {DAY_LABELS[i]} <span className="text-slate-400">{day.getDate()}</span>
            </p>
            <div className="space-y-1.5 min-h-[36px]">
              {itemsByDay[i].length === 0 ? (
                <p className="text-center text-[11px] text-slate-300">—</p>
              ) : (
                itemsByDay[i].map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold ${STATUS_STYLES[item.status]}`}
                    title={item.label}
                  >
                    <p>
                      {new Date(item.scheduled_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    <p className="truncate font-normal">{item.label}</p>
                    {item.video_call_link && item.status !== "cancelada" && (
                      <Video size={10} className="mt-0.5" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
