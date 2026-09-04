// Cuenta rápido — cálculo / atención sostenida.
// Cuenta cuántas fichas de un color hay entre las demás.
import { TimedChoice, type ChoiceRound } from "./TimedChoice";
import type { GameProps } from "./types";

const COLORES = [
  { key: "roja", label: "rojas", bg: "bg-rose-500" },
  { key: "azul", label: "azules", bg: "bg-sky-500" },
  { key: "verde", label: "verdes", bg: "bg-emerald-500" },
  { key: "amarilla", label: "amarillas", bg: "bg-amber-400" },
];

export function CuentaRapido({ level, onFinish }: GameProps) {
  const total = level.total ?? 9;
  const ms = level.ms ?? 6000;

  function make(): ChoiceRound {
    const ti = Math.floor(Math.random() * COLORES.length);
    let di = ti;
    while (di === ti) di = Math.floor(Math.random() * COLORES.length);
    const objetivo = COLORES[ti];
    const distractor = COLORES[di];
    const n = 2 + Math.floor(Math.random() * (total - 3)); // entre 2 y total-2
    const fichas = [
      ...Array(n).fill(objetivo.bg),
      ...Array(total - n).fill(distractor.bg),
    ].sort(() => Math.random() - 0.5);

    const nums = new Set<number>([n]);
    while (nums.size < 4) {
      const c = n + (Math.floor(Math.random() * 5) - 2);
      if (c >= 0 && c <= total) nums.add(c);
    }
    const options = [...nums]
      .sort(() => Math.random() - 0.5)
      .map((v) => ({ key: String(v), node: v, correct: v === n }));

    const cols = total <= 9 ? 3 : 4;
    return {
      prompt: (
        <div>
          <div className={`mx-auto grid w-fit gap-1.5`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {fichas.map((c, i) => (
              <span key={i} className={`h-7 w-7 rounded-full ${c}`} />
            ))}
          </div>
          <p className="mt-3 text-sm font-semibold text-white">
            ¿Cuántas fichas {objetivo.label} hay?
          </p>
        </div>
      ),
      options,
    };
  }

  return <TimedChoice rounds={8} ms={ms} make={make} onFinish={onFinish} />;
}
