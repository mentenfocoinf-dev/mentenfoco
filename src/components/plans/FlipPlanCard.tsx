// ============================================================================
// Tarjeta de plan con dos caras.
//
// El problema que resuelve: la lista completa de beneficios de tres planes
// puestos lado a lado convierte la página en un muro de texto, y el precio —lo
// que la persona vino a ver— queda enterrado. La cara frontal deja solo la
// decisión (nombre, precio, una línea) y el detalle se pide a propósito.
//
// Que el botón de inicio viva únicamente en el reverso también es deliberado:
// nadie llega al checkout sin haber visto qué incluye.
//
// El giro se hace con dos caras apiladas en la misma celda de grid (ver
// .flip-card en styles.css), así el alto lo fija la cara más larga y ningún
// beneficio queda cortado.
// ============================================================================
import { useState } from "react";
import { ArrowLeft, Check, Sparkles } from "lucide-react";

export interface FlipPlanCardProps {
  name: string;
  price: string;
  period: string;
  /** Una línea. El detalle va detrás. */
  desc: string;
  features: string[];
  /** URL de checkout ya construida. */
  checkoutUrl: string;
  /** Imagen de cabecera en public/. */
  image?: string;
  highlighted?: boolean;
  /** Nota bajo el botón del reverso (ej. condiciones de la etapa). */
  footnote?: string;
  onSelect?: () => void;
  selected?: boolean;
}

export function FlipPlanCard({
  name,
  price,
  period,
  desc,
  features,
  checkoutUrl,
  image,
  highlighted = false,
  footnote,
  onSelect,
  selected = false,
}: FlipPlanCardProps) {
  const [flipped, setFlipped] = useState(false);

  const caraBase =
    "flex flex-col overflow-hidden rounded-3xl border bg-white shadow-sm transition-shadow";
  const borde = highlighted
    ? "border-primary/40 shadow-lg shadow-primary/10"
    : selected
      ? "border-primary/30"
      : "border-slate-200";

  return (
    <div className={`flip-card relative h-full ${selected ? "selected-card-glow rounded-3xl" : ""}`}>
      {highlighted && (
        // Fuera del elemento que gira: si viajara con la cara, el badge
        // aparecería en espejo al voltear.
        <span className="absolute -top-3 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-1 rounded-full border border-primary/20 bg-white px-3 py-1 text-xs font-bold text-primary shadow-sm">
          <Sparkles size={11} /> Más popular
        </span>
      )}

      <div className={`flip-card-inner h-full ${flipped ? "is-flipped" : ""}`}>
        {/* ── Frente: la decisión ─────────────────────────────────────────── */}
        <div className={`${caraBase} ${borde}`} aria-hidden={flipped}>
          {image && (
            <div className="relative h-40 shrink-0 overflow-hidden">
              <img
                src={image}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
              {/* Degradado hacia el blanco de la tarjeta: sin él, el nombre del
                  plan se apoya sobre una foto y pierde contraste. */}
              <div className="absolute inset-0 bg-gradient-to-t from-white via-white/20 to-transparent" />
            </div>
          )}

          <div className="flex flex-1 flex-col p-8 pt-6">
            <h3 className="text-2xl font-bold text-primary">{name}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>

            <div className="mt-6 flex items-baseline gap-1">
              <span className="text-4xl font-bold text-slate-900">{price}</span>
              <span className="text-muted-foreground">{period}</span>
            </div>

            <div className="flex-1" />

            <button
              onClick={() => {
                setFlipped(true);
                onSelect?.();
              }}
              className={`mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold shadow-sm transition-all hover:scale-[1.02] ${
                highlighted
                  ? "bg-primary text-primary-foreground shadow-primary/20 hover:bg-primary/90"
                  : "border border-primary/20 text-primary hover:bg-primary/10"
              }`}
            >
              Conocer esta etapa
            </button>
          </div>
        </div>

        {/* ── Reverso: el detalle ─────────────────────────────────────────── */}
        <div
          className={`flip-card-back ${caraBase} ${borde} bg-white`}
          aria-hidden={!flipped}
        >
          <div className="flex flex-1 flex-col p-8">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-xl font-bold text-primary">{name}</h3>
              <span className="shrink-0 text-sm font-bold text-slate-900">
                {price}
                <span className="font-normal text-muted-foreground">{period}</span>
              </span>
            </div>

            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Qué incluye
            </p>

            <ul className="mt-4 flex-1 space-y-3">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm">
                  <Check size={15} className="mt-0.5 shrink-0 text-primary" />
                  <span className="leading-snug text-slate-700">{f}</span>
                </li>
              ))}
            </ul>

            {footnote && <p className="mt-5 text-xs text-muted-foreground">{footnote}</p>}

            <div className="mt-6 space-y-2">
              <a
                href={checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                tabIndex={flipped ? 0 : -1}
                className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] hover:bg-primary/90"
              >
                Empezar esta etapa
              </a>
              <button
                onClick={() => setFlipped(false)}
                tabIndex={flipped ? 0 : -1}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-50 hover:text-primary"
              >
                <ArrowLeft size={14} /> Volver
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
