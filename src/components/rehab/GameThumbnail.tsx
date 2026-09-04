// Miniatura visual de cada juego, para reconocerlo sin leer (accesibilidad:
// muchos usuarios se guían por la imagen). Se dibuja con el mismo lenguaje
// visual del propio juego — no necesita imágenes externas.
import { ArrowUp } from "lucide-react";
import type { GameKind } from "../../lib/api";

export function GameThumbnail({ gameKind, className }: { gameKind: GameKind; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`flex h-full w-full items-center justify-center bg-slate-900 ${className ?? ""}`}
    >
      {gameKind === "memory_pairs" && (
        <div className="grid grid-cols-3 gap-2">
          {["bg-rose-500", "bg-amber-400", "bg-emerald-500", "bg-sky-400", "bg-violet-500", "bg-slate-700"].map(
            (c, i) => (
              <span
                key={i}
                className={`flex h-10 w-10 items-center justify-center rounded-lg text-lg font-extrabold text-white ${c}`}
              >
                {i < 5 ? ["A", "B", "C", "A", "B"][i] : ""}
              </span>
            ),
          )}
        </div>
      )}

      {gameKind === "stroop_color" && (
        <div className="flex flex-col items-center gap-3">
          <span className="text-4xl font-extrabold text-sky-400">ROJO</span>
          <div className="flex gap-2">
            {["bg-rose-600", "bg-sky-500", "bg-emerald-500", "bg-amber-400"].map((c, i) => (
              <span key={i} className={`h-6 w-6 rounded-full ${c} ring-2 ring-white/80`} />
            ))}
          </div>
        </div>
      )}

      {gameKind === "sequence_recall" && (
        <div className="grid grid-cols-2 gap-2.5">
          <span className="h-11 w-11 rounded-xl bg-rose-500 opacity-70" />
          <span className="h-11 w-11 rounded-xl bg-sky-400 brightness-125 ring-4 ring-white" />
          <span className="h-11 w-11 rounded-xl bg-emerald-500 opacity-70" />
          <span className="h-11 w-11 rounded-xl bg-amber-400 opacity-70" />
        </div>
      )}

      {gameKind === "calculo_mental" && (
        <span className="text-4xl font-extrabold tracking-tight text-white">
          7 <span className="text-emerald-400">+</span> 5
        </span>
      )}

      {gameKind === "odd_one_out" && (
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <span
              key={i}
              className={`h-9 w-9 rounded-lg ${i === 4 ? "bg-amber-300 ring-2 ring-white" : "bg-sky-500"}`}
            />
          ))}
        </div>
      )}

      {gameKind === "figuras_iguales" && (
        <div className="flex items-center gap-3">
          <ArrowUp size={40} strokeWidth={2.5} className="text-sky-400" />
          <ArrowUp size={40} strokeWidth={2.5} className="text-rose-400" style={{ transform: "rotate(90deg)" }} />
          <ArrowUp size={40} strokeWidth={2.5} className="text-emerald-400" style={{ transform: "rotate(180deg)" }} />
        </div>
      )}

      {gameKind === "cuenta_rapido" && (
        <div className="grid grid-cols-3 gap-1.5">
          {["bg-rose-500", "bg-sky-500", "bg-rose-500", "bg-sky-500", "bg-rose-500", "bg-sky-500", "bg-sky-500", "bg-rose-500", "bg-sky-500"].map(
            (c, i) => (
              <span key={i} className={`h-7 w-7 rounded-full ${c}`} />
            ),
          )}
        </div>
      )}

      {gameKind === "patron_igual" && (
        <div className="flex items-center gap-4">
          {[
            ["bg-rose-500", "bg-sky-500", "bg-emerald-500", "bg-amber-400"],
            ["bg-rose-500", "bg-sky-500", "bg-emerald-500", "bg-amber-400"],
          ].map((g, k) => (
            <div key={k} className="grid grid-cols-2 gap-1">
              {g.map((c, i) => (
                <span key={i} className={`h-8 w-8 rounded ${c}`} />
              ))}
            </div>
          ))}
        </div>
      )}

      {gameKind === "que_hora" && (
        <svg viewBox="0 0 100 100" className="h-24 w-24">
          <circle cx="50" cy="50" r="44" fill="white" stroke="#0f172a" strokeWidth="4" />
          <line x1="50" y1="50" x2="50" y2="28" stroke="#0f172a" strokeWidth="5" strokeLinecap="round" />
          <line x1="50" y1="50" x2="72" y2="50" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" />
          <circle cx="50" cy="50" r="3" fill="#0f172a" />
        </svg>
      )}

      {gameKind === "emocion_situacion" && (
        <div className="flex flex-col items-center gap-2 text-white">
          <span className="rounded-2xl bg-white/10 px-4 py-2 text-sm">“¿Cómo se siente?”</span>
          <div className="flex gap-2 text-xs font-bold">
            <span className="rounded-full bg-amber-400/30 px-2 py-0.5 text-amber-200">Alegría</span>
            <span className="rounded-full bg-sky-400/30 px-2 py-0.5 text-sky-200">Calma</span>
          </div>
        </div>
      )}

      {gameKind === "ordena_pasos" && (
        <div className="flex w-40 flex-col gap-1.5">
          {[1, 2, 3].map((n) => (
            <span key={n} className="flex items-center gap-2 rounded-lg bg-white/10 px-2 py-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white">
                {n}
              </span>
              <span className="h-2 flex-1 rounded bg-white/30" />
            </span>
          ))}
        </div>
      )}

      {gameKind === "forma_palabra" && (
        <div className="flex gap-2">
          {["S", "O", "L"].map((l, i) => (
            <span
              key={i}
              className="flex h-11 w-9 items-center justify-center rounded-lg bg-white/15 text-2xl font-extrabold text-white"
            >
              {l}
            </span>
          ))}
        </div>
      )}

      {gameKind === "dia_siguiente" && (
        <div className="flex items-center gap-2 text-white">
          <span className="rounded-lg bg-white/10 px-3 py-2 text-sm font-bold">Lun</span>
          <ArrowUp size={22} strokeWidth={2.5} className="text-emerald-400" style={{ transform: "rotate(90deg)" }} />
          <span className="rounded-lg bg-white/25 px-3 py-2 text-sm font-extrabold ring-2 ring-white/40">Mar</span>
          <ArrowUp size={22} strokeWidth={2.5} className="text-white/30" style={{ transform: "rotate(90deg)" }} />
          <span className="rounded-lg bg-white/5 px-3 py-2 text-sm font-bold text-white/40">?</span>
        </div>
      )}

      {gameKind === "respuesta_adecuada" && (
        <div className="flex flex-col items-center gap-2 text-white">
          <span className="rounded-2xl bg-white/10 px-4 py-2 text-sm">“¿Qué responderías?”</span>
          <div className="flex flex-col gap-1.5 text-xs font-semibold">
            <span className="flex items-center gap-2 rounded-lg bg-emerald-500/20 px-2 py-1 text-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> Respuesta amable
            </span>
            <span className="flex items-center gap-2 rounded-lg bg-white/10 px-2 py-1 text-white/60">
              <span className="h-2 w-2 rounded-full bg-white/40" /> Otra opción
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
