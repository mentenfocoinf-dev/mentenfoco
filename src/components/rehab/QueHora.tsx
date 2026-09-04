// ¿Qué hora es? — orientación (temporal).
// Lee un reloj analógico y elige la hora correcta.
import { TimedChoice, type ChoiceRound } from "./TimedChoice";
import type { GameProps } from "./types";

function fmt(h: number, m: number) {
  return `${h}:${m.toString().padStart(2, "0")}`;
}

function Reloj({ h, m }: { h: number; m: number }) {
  const anguloH = ((h % 12) + m / 60) * 30 - 90;
  const anguloM = m * 6 - 90;
  const x = (ang: number, len: number) => 50 + len * Math.cos((ang * Math.PI) / 180);
  const y = (ang: number, len: number) => 50 + len * Math.sin((ang * Math.PI) / 180);
  return (
    <svg viewBox="0 0 100 100" className="h-28 w-28">
      <circle cx="50" cy="50" r="46" fill="white" stroke="#0f172a" strokeWidth="3" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * 30 - 90) * (Math.PI / 180);
        return (
          <circle
            key={i}
            cx={50 + 39 * Math.cos(a)}
            cy={50 + 39 * Math.sin(a)}
            r="1.6"
            fill="#0f172a"
          />
        );
      })}
      <line
        x1="50"
        y1="50"
        x2={x(anguloH, 24)}
        y2={y(anguloH, 24)}
        stroke="#0f172a"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <line
        x1="50"
        y1="50"
        x2={x(anguloM, 34)}
        y2={y(anguloM, 34)}
        stroke="#2563eb"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="50" cy="50" r="2.5" fill="#0f172a" />
    </svg>
  );
}

export function QueHora({ level, onFinish }: GameProps) {
  const ms = level.ms ?? 7000;
  const minutos = [0, 15, 30, 45];

  function make(): ChoiceRound {
    const h = 1 + Math.floor(Math.random() * 12);
    const m = minutos[Math.floor(Math.random() * minutos.length)];
    const correcta = fmt(h, m);
    const set = new Set<string>([correcta]);
    while (set.size < 4) {
      const hh = 1 + Math.floor(Math.random() * 12);
      const mm = minutos[Math.floor(Math.random() * minutos.length)];
      set.add(fmt(hh, mm));
    }
    const options = [...set]
      .sort(() => Math.random() - 0.5)
      .map((v) => ({ key: v, node: v, correct: v === correcta }));
    return {
      prompt: (
        <div className="flex justify-center">
          <Reloj h={h} m={m} />
        </div>
      ),
      options,
    };
  }

  return (
    <TimedChoice
      rounds={8}
      ms={ms}
      make={make}
      onFinish={onFinish}
      hint="¿Qué hora marca el reloj?"
    />
  );
}
