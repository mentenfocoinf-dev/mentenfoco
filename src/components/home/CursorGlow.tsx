// Luz azul tenue que sigue al cursor (solo home, ayuda a ubicar el puntero).
// - pointer-events:none → nunca interfiere con clics ni con card-neon-hover.
// - Solo en dispositivos con mouse real: (hover: hover) and (pointer: fine).
// - Performante: la posición se actualiza con transform vía rAF (sin reflow).
import { useEffect, useRef } from "react";

export function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Solo con mouse real: en touch no tiene sentido y crearía un elemento fantasma.
    if (!window.matchMedia?.("(hover: hover) and (pointer: fine)").matches) return;
    const el = ref.current;
    if (!el) return;

    let x = 0;
    let y = 0;
    let raf = 0;
    let activo = false;

    const aplicar = () => {
      raf = 0;
      el.style.setProperty("--gx", `${x}px`);
      el.style.setProperty("--gy", `${y}px`);
    };
    const onMove = (e: MouseEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!activo) {
        activo = true;
        el.classList.add("is-active");
      }
      if (!raf) raf = requestAnimationFrame(aplicar);
    };
    const onLeave = () => {
      activo = false;
      el.classList.remove("is-active");
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return <div ref={ref} className="cursor-glow" aria-hidden="true" />;
}
