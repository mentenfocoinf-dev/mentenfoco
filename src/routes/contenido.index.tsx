// ============================================================================
// Hub de contenido publicado (artículos, programas, herramientas, audio).
//
// Lista las piezas publicadas que el plan del viewer incluye. Lo que no incluye
// no se lista: no hay tarjetas con candado ni pantallas de "adquiere un plan".
// listPublishedContent() ya aplica ese filtro.
// ============================================================================
import { createFileRoute, Link } from "@tanstack/react-router";
import { RevealObserver } from "../components/home/RevealObserver";
import { useMemo, useState, useEffect } from "react";
import { BookOpen, Headphones, Loader2, Route as RouteIcon, Wrench } from "lucide-react";
import {
  trackEvent,
  listPublishedContent,
  CONTENT_TYPE_LABELS,
  type ContentMeta,
  type ContentType,
} from "../lib/api";

export const Route = createFileRoute("/contenido/")({
  head: () => ({
    meta: [
      { title: "Contenido — Mente en Foco" },
      {
        name: "description",
        content:
          "Artículos, programas, herramientas y audios de bienestar escritos por nuestro equipo clínico.",
      },
    ],
  }),
  loader: async () => {
    const items = await listPublishedContent();
    return { items };
  },
  pendingComponent: () => (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="animate-spin text-primary" size={32} />
    </div>
  ),
  component: ContenidoHub,
});

const TYPE_ICON: Record<ContentType, typeof BookOpen> = {
  blog: BookOpen, // no se usa aquí: /contenido nunca lista piezas de blog

  articulo: BookOpen,
  programa: RouteIcon,
  herramienta: Wrench,
  audio: Headphones,
};

const FILTERS: { key: ContentType | "todos"; label: string }[] = [
  { key: "todos", label: "Todo" },
  { key: "articulo", label: "Artículos" },
  { key: "programa", label: "Programas" },
  { key: "herramienta", label: "Herramientas" },
  { key: "audio", label: "Audio" },
];

function ContenidoHub() {
  // Journey Engine: registro de vista. No bloquea nada y su fallo es silencioso.
  useEffect(() => {
    trackEvent("CONTENT_VIEW");
  }, []);

  const { items } = Route.useLoaderData();
  const [filter, setFilter] = useState<ContentType | "todos">("todos");

  const visible = useMemo(
    () => (filter === "todos" ? items : items.filter((i) => i.content_type === filter)),
    [items, filter],
  );

  const counts = useMemo(() => {
    const map: Record<string, number> = { todos: items.length };
    for (const i of items) map[i.content_type] = (map[i.content_type] ?? 0) + 1;
    return map;
  }, [items]);

  return (
    <div className="reveal-scope">
      <RevealObserver />
      <section className="bg-[url('/BANNER.jpg')] bg-cover bg-center bg-no-repeat py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4 text-center glass-card mx-4 rounded-3xl py-16 shadow-lg border border-white/40">
          <h1 className="text-4xl font-bold text-primary md:text-5xl drop-shadow-sm">Contenido</h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Artículos, programas, herramientas y audios escritos por nuestro equipo clínico. Con
            fundamento, en lenguaje claro.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="mb-10 flex flex-wrap justify-center gap-3">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-5 py-2.5 text-sm font-bold transition-all shadow-sm ${
                filter === f.key
                  ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
                  : "glass border border-white/40 text-foreground hover:border-primary/50 hover:bg-primary/5"
              }`}
            >
              {f.label} <span className="opacity-70 font-medium">({counts[f.key] ?? 0})</span>
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white/50 p-12 text-center">
            <p className="text-sm text-muted-foreground">
              Todavía no hay contenido publicado en esta categoría. Estamos preparándolo.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {visible.map((item) => (
              <ContentCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ContentCard({ item }: { item: ContentMeta }) {
  const Icon = TYPE_ICON[item.content_type] ?? BookOpen;

  return (
    <Link
      to="/contenido/$slug"
      params={{ slug: item.slug }}
      className="card-neon-hover group relative flex h-full flex-col overflow-hidden rounded-3xl border-border bg-white p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
    >
      {item.cover_image && (
        <div
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-20 transition-opacity group-hover:opacity-30"
          style={{ backgroundImage: `url('/contenido/${item.cover_image}')` }}
        />
      )}
      <div className="relative z-10 flex h-full flex-col">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/10 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            <Icon size={12} /> {CONTENT_TYPE_LABELS[item.content_type]}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            {item.categoria}
          </span>
        </div>
        <h3 className="text-xl font-bold text-primary transition-colors group-hover:text-primary/80">
          {item.titulo}
        </h3>
        <p className="mt-3 flex-grow text-sm text-foreground/80">{item.resumen_breve}</p>
        <div className="mt-8 flex items-center justify-between border-t border-border/50 pt-4 text-xs">
          <span className="font-semibold text-muted-foreground">
            {item.tiempo_lectura ?? "Lectura breve"}
          </span>
          <span className="rounded-lg border border-primary/20 bg-primary/10 px-4 py-2 font-bold text-primary transition-colors group-hover:bg-primary/20">
            Leer
          </span>
        </div>
      </div>
    </Link>
  );
}
