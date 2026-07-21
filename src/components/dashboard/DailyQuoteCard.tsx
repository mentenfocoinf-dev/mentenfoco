// ============================================================================
// Frase del día.
//
// La frase se elige por día del año, no al azar: así se mantiene estable
// durante toda la jornada y no cambia en cada render ni al recargar, que es lo
// que espera alguien que vuelve al panel varias veces al día.
// ============================================================================
import { Quote } from "lucide-react";

const QUOTES: { text: string; author: string }[] = [
  {
    text: "No tienes que ver toda la escalera, solo dar el primer paso.",
    author: "Martin Luther King Jr.",
  },
  {
    text: "Cuidar de ti mismo no es un acto de egoísmo, es un acto de supervivencia.",
    author: "Audre Lorde",
  },
  {
    text: "Entre el estímulo y la respuesta hay un espacio, y en ese espacio está nuestra libertad.",
    author: "Viktor Frankl",
  },
  {
    text: "Lo que se siente no siempre es lo que es. Las emociones informan, no dictan.",
    author: "Equipo clínico Mente en Foco",
  },
  {
    text: "Pedir ayuda no es rendirse, es negarse a rendirse.",
    author: "Charlie Mackesy",
  },
];

/** Día del año (1..366): índice estable dentro de la jornada. */
function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000);
}

export function DailyQuoteCard() {
  const quote = QUOTES[dayOfYear(new Date()) % QUOTES.length];

  return (
    <div className="card-neon-hover rounded-3xl glass-card border border-white/40 p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-center gap-2 text-primary">
        <Quote size={16} strokeWidth={2} />
        <h3 className="text-sm font-bold">Frase del día</h3>
      </div>
      <blockquote className="mt-3 text-sm leading-relaxed text-slate-700">
        “{quote.text}”
      </blockquote>
      <p className="mt-2 text-xs text-muted-foreground">— {quote.author}</p>
    </div>
  );
}
