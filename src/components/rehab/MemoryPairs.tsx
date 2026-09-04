// Pares de memoria — memoria de trabajo / atención selectiva.
// Al empezar muestra todas las cartas unos segundos (fase de memorización),
// luego se tapan y se juega. Pensado sobre fondo OSCURO (alto contraste).
import { useEffect, useMemo, useRef, useState } from "react";
import { Timer, RotateCcw, Eye } from "lucide-react";
import type { GameProps } from "./types";

const SYMBOLS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
const COLORS = [
  "bg-rose-500",
  "bg-amber-400",
  "bg-emerald-500",
  "bg-sky-400",
  "bg-violet-500",
  "bg-orange-400",
  "bg-teal-400",
  "bg-fuchsia-500",
];

interface Carta {
  id: number;
  par: number;
}

function barajar(pares: number): Carta[] {
  const cartas: Carta[] = [];
  for (let p = 0; p < pares; p++) {
    cartas.push({ id: p * 2, par: p }, { id: p * 2 + 1, par: p });
  }
  for (let i = cartas.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cartas[i], cartas[j]] = [cartas[j], cartas[i]];
  }
  return cartas;
}

type Fase = "preview" | "jugando";

export function MemoryPairs({ level, onFinish }: GameProps) {
  const pares = Math.min(level.pairs ?? 3, SYMBOLS.length);
  const previewMs = level.previewMs ?? 2500;
  const [cartas, setCartas] = useState<Carta[]>(() => barajar(pares));
  const [fase, setFase] = useState<Fase>("preview");
  const [volteadas, setVolteadas] = useState<number[]>([]);
  const [emparejadas, setEmparejadas] = useState<Set<number>>(new Set());
  const [intentos, setIntentos] = useState(0);
  const [segundos, setSegundos] = useState(0);
  const bloqueado = useRef(false);
  const finalizado = useRef(false);

  // Fase de memorización: todas visibles, luego se tapan y arranca el juego.
  useEffect(() => {
    if (fase !== "preview") return;
    const t = setTimeout(() => setFase("jugando"), previewMs);
    return () => clearTimeout(t);
  }, [fase, previewMs]);

  // El cronómetro corre solo mientras se juega (no durante la memorización).
  useEffect(() => {
    if (fase !== "jugando") return;
    const t = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [fase]);

  const columnas = useMemo(() => (pares <= 3 ? "grid-cols-3" : "grid-cols-4"), [pares]);

  function reiniciar() {
    setCartas(barajar(pares));
    setFase("preview");
    setVolteadas([]);
    setEmparejadas(new Set());
    setIntentos(0);
    setSegundos(0);
    bloqueado.current = false;
    finalizado.current = false;
  }

  function tocar(idx: number) {
    if (fase !== "jugando" || bloqueado.current || finalizado.current) return;
    if (volteadas.includes(idx) || emparejadas.has(cartas[idx].par)) return;

    const nuevas = [...volteadas, idx];
    setVolteadas(nuevas);

    if (nuevas.length === 2) {
      setIntentos((n) => n + 1);
      const [a, b] = nuevas;
      if (cartas[a].par === cartas[b].par) {
        const emp = new Set(emparejadas).add(cartas[a].par);
        setEmparejadas(emp);
        setVolteadas([]);
        if (emp.size === pares && !finalizado.current) {
          finalizado.current = true;
          const totalIntentos = intentos + 1;
          const precision = pares / Math.max(totalIntentos, pares);
          const score = Math.max(0, Math.round(1000 - segundos * 5 - (totalIntentos - pares) * 20));
          setTimeout(
            () => onFinish({ score, accuracy: precision, durationSeconds: segundos, completed: true }),
            400,
          );
        }
      } else {
        bloqueado.current = true;
        setTimeout(() => {
          setVolteadas([]);
          bloqueado.current = false;
        }, 800);
      }
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-semibold text-white">
        {fase === "preview" ? (
          <span className="inline-flex items-center gap-1.5 text-amber-300">
            <Eye size={16} /> Memoriza…
          </span>
        ) : (
          <>
            <span className="inline-flex items-center gap-1.5">
              <Timer size={16} /> {segundos}s
            </span>
            <span>Intentos: {intentos}</span>
            <span>
              Pares: {emparejadas.size}/{pares}
            </span>
          </>
        )}
        <button
          type="button"
          onClick={reiniciar}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 px-2.5 py-1 text-xs text-white/90 hover:bg-white/10"
        >
          <RotateCcw size={13} /> Reiniciar
        </button>
      </div>

      <div className={`mx-auto grid max-w-md gap-3 ${columnas}`}>
        {cartas.map((c, idx) => {
          const abierta = fase === "preview" || volteadas.includes(idx) || emparejadas.has(c.par);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => tocar(idx)}
              aria-label={abierta ? `Carta ${SYMBOLS[c.par]}` : "Carta oculta"}
              className={`flex aspect-square items-center justify-center rounded-2xl text-3xl font-extrabold text-white shadow-md transition-all duration-200 ${
                abierta ? `${COLORS[c.par]}` : "bg-slate-700 hover:bg-slate-600"
              }`}
            >
              {abierta ? SYMBOLS[c.par] : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}
