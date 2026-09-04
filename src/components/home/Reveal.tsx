// Aparición suave al entrar en pantalla (solo home, experimento estético).
// Usa IntersectionObserver (no listeners de scroll). Respeta
// prefers-reduced-motion: quien lo pide, ve el contenido de inmediato sin
// animación. El contenido siempre está en el DOM (SSR) — solo cambia su
// visibilidad — así que no afecta SEO; para no-JS hay un <noscript> en la home.
import { useEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
  /** Etiqueta a renderizar (para no meter divs de más alrededor de <section>). */
  as?: "div" | "section";
  /** Above-the-fold: aparece ya, sin esperar al observer (evita parpadeo). */
  immediate?: boolean;
}

export function Reveal({ children, className = "", as = "div", immediate = false }: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(immediate);

  useEffect(() => {
    if (immediate || visible) return;
    const el = ref.current;
    if (!el) return;
    // Accesibilidad: si pide menos movimiento, aparece directo, sin observer.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const ob = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            ob.disconnect();
            break;
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -8% 0px" },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [immediate, visible]);

  const cls = `reveal ${visible ? "is-visible" : ""} ${className}`.trim();
  const Tag = as as "div";
  return (
    <Tag ref={ref as React.Ref<HTMLDivElement>} className={cls}>
      {children}
    </Tag>
  );
}
