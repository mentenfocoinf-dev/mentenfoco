// Secuencia — memoria secuencial / atención sostenida.
// Se ilumina una secuencia de fichas cada vez más larga; hay que repetirla.
import { useEffect, useRef, useState } from "react";
import type { GameProps } from "./types";

const PADS = [
  { bg: "bg-rose-500", on: "bg-rose-300" },
  { bg: "bg-sky-500", on: "bg-sky-300" },
  { bg: "bg-emerald-500", on: "bg-emerald-300" },
  { bg: "bg-amber-500", on: "bg-amber-300" },
];

type Fase = "mostrando" | "ingreso" | "fin";

function secuenciaInicial(largo: number): number[] {
  return Array.from({ length: largo }, () => Math.floor(Math.random() * PADS.length));
}

export function SequenceRecall({ level, onFinish }: GameProps) {
  const inicio = Math.max(level.start ?? 3, 2);
  const [seq, setSeq] = useState<number[]>(() => secuenciaInicial(inicio));
  const [fase, setFase] = useState<Fase>("mostrando");
  const [pos, setPos] = useState(0);
  const [activo, setActivo] = useState<number | null>(null);
  const [rondas, setRondas] = useState(0);
  const inicioTs = useRef(Date.now());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Reproduce la secuencia y pasa a modo ingreso.
  useEffect(() => {
    if (fase !== "mostrando") return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    let t = 500;
    seq.forEach((pad) => {
      timers.current.push(setTimeout(() => setActivo(pad), t));
      timers.current.push(setTimeout(() => setActivo(null), t + 450));
      t += 700;
    });
    timers.current.push(
      setTimeout(() => {
        setFase("ingreso");
        setPos(0);
      }, t),
    );
    return () => timers.current.forEach(clearTimeout);
  }, [fase, seq]);

  function tocar(pad: number) {
    if (fase !== "ingreso") return;
    setActivo(pad);
    setTimeout(() => setActivo(null), 200);

    if (pad === seq[pos]) {
      if (pos === seq.length - 1) {
        // ronda superada → alarga la secuencia
        setRondas((r) => r + 1);
        setSeq((s) => [...s, Math.floor(Math.random() * PADS.length)]);
        setFase("mostrando");
      } else {
        setPos((p) => p + 1);
      }
    } else {
      // fallo → fin
      setFase("fin");
      const largoAlcanzado = seq.length;
      const dur = Math.round((Date.now() - inicioTs.current) / 1000);
      onFinish({
        score: largoAlcanzado * 10,
        accuracy: Math.min(1, rondas / 4),
        durationSeconds: dur,
        completed: rondas > 0,
      });
    }
  }

  return (
    <div className="text-center">
      <div className="mb-4 flex items-center justify-center gap-6 text-sm font-semibold text-white">
        <span>Longitud: {seq.length}</span>
        <span>Rondas superadas: {rondas}</span>
        <span className="text-amber-300">
          {fase === "mostrando" ? "Observa…" : fase === "ingreso" ? "Tu turno" : "Fin"}
        </span>
      </div>

      <div className="mx-auto grid max-w-sm grid-cols-2 gap-4">
        {PADS.map((p, i) => (
          <button
            key={i}
            type="button"
            disabled={fase !== "ingreso"}
            onClick={() => tocar(i)}
            aria-label={`Ficha ${i + 1}`}
            className={`aspect-square rounded-3xl transition-all duration-150 ${
              activo === i
                ? `${p.on} scale-105 brightness-125 ring-4 ring-white shadow-2xl`
                : `${p.bg} opacity-70`
            } ${fase === "ingreso" ? "cursor-pointer hover:opacity-100" : "cursor-default"}`}
          />
        ))}
      </div>

      {fase === "mostrando" && (
        <p className="mt-4 text-sm text-white/80">Memoriza el orden de las luces.</p>
      )}
    </div>
  );
}
