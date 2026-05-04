import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { guiasClinicas } from "../data/guiasData";

export const Route = createFileRoute("/guia")({
  head: () => ({
    meta: [
      { title: "Guías — Mente en Foco" },
      { name: "description", content: "Guías prácticas para ansiedad, autoestima, motricidad y bienestar emocional." },
      { property: "og:title", content: "Guías — Mente en Foco" },
      { property: "og:description", content: "Guías prácticas para afrontar diferentes situaciones de la vida." },
    ],
  }),
  component: Guia,
});

const categories = [
  { name: "Todas", count: 12 },
  { name: "Ansiedad", count: 3 },
  { name: "Autoestima", count: 3 },
  { name: "Infantil", count: 3 },
  { name: "Relaciones", count: 3 },
];

function Guia() {
  const [activeFilter, setActiveFilter] = useState("Todas");

  const filteredGuides = activeFilter === "Todas"
    ? guiasClinicas
    : guiasClinicas.filter((g) => g.categoria === activeFilter);

  return (
    <>
      <section className="bg-[url('/BANNER.jpg')] bg-cover bg-center bg-no-repeat py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4 text-center glass-card mx-4 rounded-3xl py-16 shadow-lg border border-white/40">
          <h1 className="text-4xl font-bold text-primary md:text-5xl drop-shadow-sm">Guías de bienestar</h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Recursos prácticos desarrollados por nuestros profesionales clínicos para acompañarte en distintos
            momentos de tu vida. Escritos desde la ciencia y la empatía.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="mb-10 flex flex-wrap gap-3 justify-center">
          {categories.map((c) => (
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
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredGuides.map((g) => (
            <article
              key={g.id}
              className="card-neon-hover group relative rounded-3xl border-border bg-white overflow-hidden p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl flex flex-col h-full"
            >
              <div
                className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-20 transition-opacity group-hover:opacity-30"
                style={{ backgroundImage: `url('/guias/${g.imageName}')` }}
              />
              <div className="relative z-10 flex flex-col h-full">
                <div className="mb-2">
                  <span className="inline-block rounded-full bg-primary/10 border border-primary/10 px-3 py-1 text-xs font-bold text-primary">
                    {g.categoria}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-primary group-hover:text-primary/80 transition-colors">
                  {g.titulo}
                </h3>
                <p className="mt-3 text-sm text-foreground/80 flex-grow">{g.descripcionBreve}</p>

                <div className="mt-8 pt-4 border-t border-border/50 flex items-center justify-between text-xs">
                  <span className="font-semibold text-muted-foreground">Lectura de {g.tiempoLectura}</span>
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
          ))}
        </div>
      </section>
    </>
  );
}
