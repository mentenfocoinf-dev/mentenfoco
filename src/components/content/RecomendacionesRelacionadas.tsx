// ============================================================================
// Bloque "También te puede servir".
//
// Sugiere, no empuja. Va DESPUÉS del contenido, nunca interrumpe la lectura, y
// si no hay nada válido no se dibuja (G8): un bloque vacío es mejor que uno
// relleno, y la tentación de "siempre mostrar algo" es lo que convierte un motor
// útil en ruido.
//
// El cálculo vive en recommendationsService. Aquí solo se muestra el resultado
// y se registra qué se sugirió y qué se abrió — sin eso es imposible saber qué
// reglas sirven y cuáles solo hacen ruido.
// ============================================================================
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen, Clock, Compass, Headphones, Wrench } from "lucide-react";
import {
  getRecommendations,
  trackEvent,
  type Recommendation,
  type RecommendationContext,
} from "../../lib/api";

const ICONO: Record<string, typeof BookOpen> = {
  guia: Compass,
  articulo: BookOpen,
  herramienta: Wrench,
  audio: Headphones,
};

const ETIQUETA: Record<string, string> = {
  guia: "Guía",
  articulo: "Artículo",
  herramienta: "Herramienta",
  audio: "Audio",
};

/**
 * El título es configurable porque el mismo bloque se usa en dos sitios donde
 * la frase honesta es distinta: al pie de una pieza es una sugerencia lateral
 * ("también te puede servir"); en el dashboard es la continuación de lo último
 * que se leyó. El cálculo es el mismo y por eso el componente es el mismo.
 */
export function RecomendacionesRelacionadas(
  props: RecommendationContext & { titulo?: string; subtitulo?: string },
) {
  const { source, currentId, categoria, tipoActual, themeKey, tags } = props;
  const [items, setItems] = useState<Recommendation[]>([]);
  const registrado = useRef<string | null>(null);

  // `tags` llega como array nuevo en cada render; comparado por identidad
  // relanzaría el efecto en bucle. Se compara por contenido.
  const tagsClave = (tags ?? []).join("|");

  useEffect(() => {
    let vigente = true;
    void getRecommendations({
      source,
      currentId,
      categoria,
      tipoActual,
      themeKey,
      tags: tagsClave ? tagsClave.split("|") : null,
    }).then((r) => {
      if (vigente) setItems(r);
    });
    return () => {
      vigente = false;
    };
  }, [source, currentId, categoria, tipoActual, themeKey, tagsClave]);

  // Se registra qué se mostró y con qué regla. El guard no es paranoia: en
  // StrictMode el efecto corre dos veces y duplicaría el evento — ya pasó con el
  // registro de los tests públicos.
  useEffect(() => {
    if (items.length === 0) return;
    if (registrado.current === currentId) return;
    registrado.current = currentId;
    trackEvent("RECOMMENDATION_SHOWN", {
      resource_id: currentId,
      resource_type: tipoActual,
      // Cuántas y bajo qué regla. Nunca el contenido de la pieza.
      count: items.length,
      rule: items[0].regla,
    });
  }, [items, currentId, tipoActual]);

  // G8: sin candidatos válidos no hay bloque.
  if (items.length === 0) return null;

  return (
    <section className="mt-14 border-t border-slate-200 pt-10">
      <h2 className="text-xl font-bold text-primary">
        {props.titulo ?? "También te puede servir"}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {props.subtitulo ?? `Otras piezas de nuestro equipo sobre ${categoria.toLowerCase()}.`}
      </p>

      <ul className="mt-6 grid gap-4 md:grid-cols-3">
        {items.map((r) => {
          const Icon = ICONO[r.tipo] ?? BookOpen;
          return (
            <li key={`${r.tipo}-${r.id}`}>
              <Link
                to={r.href}
                onClick={() =>
                  trackEvent("RECOMMENDATION_ACCEPTED", {
                    resource_id: r.id,
                    resource_type: r.tipo,
                    rule: r.regla,
                  })
                }
                className="card-neon-hover group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="flex h-full flex-col">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon size={15} />
                    </span>
                    <span className="text-xs font-bold text-primary">
                      {ETIQUETA[r.tipo] ?? "Recurso"}
                    </span>
                  </div>

                  <h3 className="mt-3 text-base font-bold leading-snug text-slate-900 transition-colors group-hover:text-primary">
                    {r.titulo}
                  </h3>
                  <p className="mt-2 line-clamp-3 flex-grow text-sm leading-relaxed text-foreground/75">
                    {r.descripcion}
                  </p>

                  {r.tiempo && (
                    <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                      <Clock size={12} /> {r.tiempo}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
