// Observador de "aparición al hacer scroll" para las secciones de una página
// pública. Va como primer hijo (invisible) del contenedor .reveal-scope y observa
// las <section> hermanas.
//
// ¿Por qué aquí y no un manager global? Porque su useEffect corre DESPUÉS de que
// hidrata el subárbol de ESTA ruta (que se carga en un chunk lazy dentro de un
// <Suspense>). Un manager en el layout raíz corre antes de esa hidratación y
// mutaría el DOM a mitad → "hydration mismatch". Este, no.
//
// Respeta prefers-reduced-motion (muestra todo de una). Salta la primera sección
// (el hero, above-the-fold): igual que la regla CSS `:not(:first-of-type)`.
import { useEffect, useRef } from "react";

export function RevealObserver() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const scope = ref.current?.parentElement;
    if (!scope) return;

    const secciones = Array.from(scope.querySelectorAll<HTMLElement>(":scope > section"));
    const objetivos = secciones.slice(1); // salta el hero (primera sección)
    if (objetivos.length === 0) return;

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      objetivos.forEach((s) => s.classList.add("is-visible"));
      return;
    }

    const ob = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            ob.unobserve(e.target);
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -8% 0px" },
    );
    objetivos.forEach((s) => {
      if (!s.classList.contains("is-visible")) ob.observe(s);
    });
    return () => ob.disconnect();
  }, []);

  return <span ref={ref} hidden />;
}
