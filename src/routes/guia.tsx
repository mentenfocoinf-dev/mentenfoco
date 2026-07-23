import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, Lock } from "lucide-react";
import { listGuides, isFreeLeadAccount, PLAN_LABELS, type GuideMeta } from "../lib/api";
import type { PlanType } from "../lib/supabase";

export const Route = createFileRoute("/guia")({
  head: () => ({
    meta: [
      { title: "Guías — Mente en Foco" },
      {
        name: "description",
        content: "Guías prácticas para ansiedad, autoestima, motricidad y bienestar emocional.",
      },
      { property: "og:title", content: "Guías — Mente en Foco" },
      {
        property: "og:description",
        content: "Guías prácticas para afrontar diferentes situaciones de la vida.",
      },
    ],
  }),
  loader: async () => {
    // La vista de metadatos muestra TODAS las guías (también las premium), para
    // que el visitante vea el catálogo completo con su nivel requerido. isFreeLead
    // decide qué candado le corresponde a cada tarjeta: ver la nota en guidesService.
    const [guias, isFreeLead] = await Promise.all([listGuides(), isFreeLeadAccount()]);
    return { guias, isFreeLead };
  },
  pendingComponent: () => (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="animate-spin text-primary" size={32} />
    </div>
  ),
  component: Guia,
});

/** Pills fijas en la fila principal; el resto vive en el desplegable "Más categorías".
 *  Con 8 categorías hoy caben 5 + Todas sin desbordar a una segunda línea; al
 *  llegar las 5 categorías nuevas (13 en total) el patrón sigue funcionando sin
 *  tocar código, solo cambia cuántas quedan en el desplegable. */
const PINNED_PILL_COUNT = 5;

function Guia() {
  const { guias, isFreeLead } = Route.useLoaderData();
  const [activeFilter, setActiveFilter] = useState("Todas");
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const categoriesMap: Record<string, number> = {};
  guias.forEach((g) => {
    categoriesMap[g.categoria] = (categoriesMap[g.categoria] || 0) + 1;
  });

  const categoriesByCount = Object.keys(categoriesMap)
    .map((name) => ({ name, count: categoriesMap[name] }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const pinned = categoriesByCount.slice(0, PINNED_PILL_COUNT);
  const overflow = categoriesByCount.slice(PINNED_PILL_COUNT);
  const activeInOverflow = overflow.some((c) => c.name === activeFilter);

  const filteredGuides =
    activeFilter === "Todas" ? guias : guias.filter((g) => g.categoria === activeFilter);

  /**
   * Regla del candado, distinta según quién mira:
   * - Cuenta gratuita/anónima: solo puede LEER lo marcado `visible_en_plan_gratis`.
   *   Hay guías con `min_plan='free'` que no son de vitrina — siguen bloqueadas
   *   para este grupo aunque estructuralmente sean "gratis".
   * - Cualquier otro viewer (plan pago, terapeuta, admin): la regla estructural
   *   de siempre, `min_plan !== 'free'`.
   * Para quien ve el candado por ser cuenta gratuita, el plan que realmente lo
   * desbloquea siempre es el más económico de pago (esencial) — subir de plan
   * da acceso al catálogo completo, sin importar el min_plan real de la guía.
   */
  function lockInfo(g: GuideMeta): { locked: boolean; plan: PlanType } {
    if (isFreeLead) return { locked: !g.visible_en_plan_gratis, plan: "esencial" };
    return { locked: g.min_plan !== "free", plan: g.min_plan };
  }

  return (
    <>
      <section className="bg-[url('/BANNER.jpg')] bg-cover bg-center bg-no-repeat py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4 text-center glass-card mx-4 rounded-3xl py-16 shadow-lg border border-white/40">
          <h1 className="text-4xl font-bold text-primary md:text-5xl drop-shadow-sm">
            Guías de bienestar
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Recursos prácticos desarrollados por nuestros profesionales clínicos para acompañarte en
            distintos momentos de tu vida. Escritos desde la ciencia y la empatía.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="mb-10 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => setActiveFilter("Todas")}
            className={`rounded-full px-5 py-2.5 text-sm font-bold transition-all shadow-sm ${
              activeFilter === "Todas"
                ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90 hover:scale-105"
                : "glass border border-white/40 text-foreground hover:border-primary/50 hover:bg-primary/5"
            }`}
          >
            Todas <span className="opacity-70 font-medium">({guias.length})</span>
          </button>

          {pinned.map((c) => (
            <button
              key={c.name}
              onClick={() => setActiveFilter(c.name)}
              className={`rounded-full px-5 py-2.5 text-sm font-bold transition-all shadow-sm ${
                activeFilter === c.name
                  ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90 hover:scale-105"
                  : "glass border border-white/40 text-foreground hover:border-primary/50 hover:bg-primary/5"
              }`}
            >
              {c.name} <span className="opacity-70 font-medium">({c.count})</span>
            </button>
          ))}

          {overflow.length > 0 && (
            <div className="relative" ref={moreRef}>
              <button
                onClick={() => setMoreOpen((v) => !v)}
                className={`flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-bold transition-all shadow-sm ${
                  activeInOverflow
                    ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
                    : "glass border border-white/40 text-foreground hover:border-primary/50 hover:bg-primary/5"
                }`}
              >
                {activeInOverflow ? activeFilter : "Más categorías"}
                <ChevronDown
                  size={15}
                  className={`transition-transform ${moreOpen ? "rotate-180" : ""}`}
                />
              </button>

              {moreOpen && (
                <div className="absolute left-1/2 top-full z-50 mt-2 w-56 -translate-x-1/2 rounded-2xl border border-white/40 glass p-1.5 shadow-lg animate-in fade-in slide-in-from-top-2">
                  {overflow.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => {
                        setActiveFilter(c.name);
                        setMoreOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors ${
                        activeFilter === c.name
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-primary/5"
                      }`}
                    >
                      {c.name}
                      <span className="text-xs font-medium opacity-60">({c.count})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredGuides.map((g) => {
            const { locked, plan } = lockInfo(g);
            return (
              <article
                key={g.id}
                className="card-neon-hover group relative rounded-3xl border-border bg-white overflow-hidden p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl flex flex-col h-full"
              >
                <div
                  className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-20 transition-opacity group-hover:opacity-30"
                  style={{ backgroundImage: `url('/guias/${g.imageName}')` }}
                />
                <div className="relative z-10 flex flex-col h-full">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="inline-block rounded-full bg-primary/10 border border-primary/10 px-3 py-1 text-xs font-bold text-primary">
                      {g.categoria}
                    </span>
                    {locked && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-200 px-3 py-1 text-xs font-bold text-amber-700">
                        <Lock size={11} /> {PLAN_LABELS[plan].replace("Plan ", "")}
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-primary group-hover:text-primary/80 transition-colors">
                    {g.titulo}
                  </h3>
                  <p className="mt-3 text-sm text-foreground/80 flex-grow">{g.descripcionBreve}</p>

                  <div className="mt-8 pt-4 border-t border-border/50 flex items-center justify-between text-xs">
                    <span className="font-semibold text-muted-foreground">
                      Lectura de {g.tiempoLectura}
                    </span>
                    <Link
                      to="/guias/$guiaId"
                      params={{ guiaId: g.id }}
                      className="font-bold text-primary bg-primary/10 hover:bg-primary/20 px-4 py-2 rounded-lg transition-colors border border-primary/20 backdrop-blur"
                    >
                      Leer guía
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
