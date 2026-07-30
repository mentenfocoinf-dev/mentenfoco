// ============================================================================
// Cabecera con fotografía.
//
// El patrón de la casa es "foto de fondo + tarjeta glass encima". Funciona con
// el BANNER original, que es suave; con fotos reales —más contrastadas y con
// zonas oscuras— el texto pierde legibilidad según dónde caiga el recorte.
//
// Por eso hay DOS capas fijas entre la foto y el contenido: un velo blanco
// uniforme y un degradado que aclara la parte inferior, que es donde se apoya
// la tarjeta. Así el contraste no depende de qué imagen se ponga ni de cómo la
// recorte el navegador en cada tamaño de pantalla.
// ============================================================================
import type { ReactNode } from "react";

interface Props {
  /** Ruta en public/, ej. "/servicios/psiquiatria.jpg". */
  image: string;
  children: ReactNode;
  /** Alto extra para los heroes largos (inicio). */
  tall?: boolean;
  className?: string;
}

export function HeroImagen({ image, children, tall = false, className }: Props) {
  return (
    <section
      className={`relative overflow-hidden bg-cover bg-center bg-no-repeat ${
        tall ? "py-20 md:py-28" : "py-16 md:py-20"
      } ${className ?? ""}`}
      style={{ backgroundImage: `url('${image}')` }}
    >
      <div aria-hidden="true" className="absolute inset-0 bg-white/55" />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-white/30 via-white/50 to-white/80"
      />
      <div className="relative z-10">{children}</div>
    </section>
  );
}
