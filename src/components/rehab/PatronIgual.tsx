// Patrón igual — visualización espacial / atención selectiva.
// Elige, entre las opciones, la cuadrícula idéntica al modelo.
import { TimedChoice, type ChoiceRound } from "./TimedChoice";
import type { GameProps } from "./types";

const COLS = [
  "bg-rose-500",
  "bg-sky-500",
  "bg-emerald-500",
  "bg-amber-400",
  "bg-violet-500",
  "bg-slate-500",
];

function patron(): number[] {
  return Array.from({ length: 4 }, () => Math.floor(Math.random() * COLS.length));
}

function igual(a: number[], b: number[]) {
  return a.every((v, i) => v === b[i]);
}

function Grid({ p, size }: { p: number[]; size: string }) {
  return (
    <div className="grid grid-cols-2 gap-1">
      {p.map((c, i) => (
        <span key={i} className={`${size} rounded ${COLS[c]}`} />
      ))}
    </div>
  );
}

export function PatronIgual({ level, onFinish }: GameProps) {
  const ms = level.ms ?? 5000;

  function make(): ChoiceRound {
    const modelo = patron();
    const opciones: number[][] = [modelo];
    let guard = 0;
    while (opciones.length < 4 && guard++ < 50) {
      const c = patron();
      if (!opciones.some((o) => igual(o, c))) opciones.push(c);
    }
    opciones.sort(() => Math.random() - 0.5);
    return {
      prompt: (
        <div className="flex flex-col items-center">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-white/60">Modelo</p>
          <Grid p={modelo} size="h-9 w-9" />
        </div>
      ),
      options: opciones.map((o, i) => ({
        key: String(i),
        node: <Grid p={o} size="h-7 w-7" />,
        correct: igual(o, modelo),
      })),
    };
  }

  return (
    <TimedChoice
      rounds={8}
      ms={ms}
      make={make}
      onFinish={onFinish}
      hint="Elige la cuadrícula idéntica."
    />
  );
}
