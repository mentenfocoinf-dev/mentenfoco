// ============================================================================
// Blog público — la cara abierta de Mente en Foco.
//
// Sección propia, no un espejo de /contenido: desde el 29-jul una pieza vive en
// una sola sección y el blog es `content_type = 'blog'`. Aquí no se filtra por
// plan porque el blog es público por definición —un CHECK en la base ata las
// piezas de blog a `min_plan = 'free'`— y es donde vive la conversación con los
// pacientes: cada post lleva sus comentarios moderados.
//
// Se llama `blog.index.tsx` (no `blog.tsx`) a propósito: con un hermano
// `blog.$slug.tsx`, un `blog.tsx` se convertiría en layout padre y el hub se
// dibujaría encima de cada artículo.
// ============================================================================
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Clock, Loader2 } from "lucide-react";
import { listBlogArticles } from "../lib/api";
import { useEffect } from "react";
import { trackEvent } from "../lib/api";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "Blog y artículos — Mente en Foco" },
      {
        name: "description",
        content:
          "Artículos gratuitos sobre ansiedad, ánimo, sueño y bienestar emocional, escritos por nuestro equipo clínico.",
      },
      { property: "og:title", content: "Blog y artículos — Mente en Foco" },
      {
        property: "og:description",
        content: "Salud mental explicada con claridad, sin tecnicismos y sin registro.",
      },
    ],
  }),
  loader: async () => ({ articulos: await listBlogArticles() }),
  pendingComponent: () => (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="animate-spin text-primary" size={32} />
    </div>
  ),
  component: BlogHub,
});

function BlogHub() {
  // Journey Engine: registro de vista. No bloquea nada y su fallo es silencioso.
  useEffect(() => {
    trackEvent("BLOG_VIEW");
  }, []);

  const { articulos } = Route.useLoaderData();

  return (
    <>
      <section className="bg-[url('/BANNER.jpg')] bg-cover bg-center bg-no-repeat py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4 text-center glass-card mx-4 rounded-3xl py-16 shadow-lg border border-white/40">
          <h1 className="text-4xl font-bold text-primary md:text-5xl drop-shadow-sm">
            Blog y artículos
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Salud mental explicada con claridad, escrita por nuestro equipo clínico. Lectura libre,
            sin registro.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        {articulos.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white/50 p-12 text-center">
            <p className="text-sm text-muted-foreground">
              Todavía no hay artículos publicados. Estamos preparándolos.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {articulos.map((a) => (
              <Link
                key={a.id}
                to="/blog/$slug"
                params={{ slug: a.slug }}
                className="card-neon-hover group relative flex h-full flex-col overflow-hidden rounded-3xl border-border bg-white p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                {a.cover_image && (
                  <div
                    className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-20 transition-opacity group-hover:opacity-30"
                    style={{ backgroundImage: `url('/contenido/${a.cover_image}')` }}
                  />
                )}
                <div className="relative z-10 flex h-full flex-col">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-primary/10 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                      {a.categoria}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-primary transition-colors group-hover:text-primary/80">
                    {a.titulo}
                  </h2>
                  <p className="mt-3 flex-grow text-sm text-foreground/80">{a.resumen_breve}</p>
                  <div className="mt-8 flex items-center justify-between border-t border-border/50 pt-4 text-xs">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-muted-foreground">
                      <Clock size={13} /> {a.tiempo_lectura ?? "Lectura breve"}
                    </span>
                    <span className="rounded-lg border border-primary/20 bg-primary/10 px-4 py-2 font-bold text-primary transition-colors group-hover:bg-primary/20">
                      Leer
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-14 rounded-3xl border border-primary/15 bg-primary/5 p-8 text-center">
          <h2 className="text-xl font-bold text-primary">¿Quieres ir más a fondo?</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Nuestras guías clínicas desarrollan cada tema paso a paso, con ejercicios prácticos.
          </p>
          <Link
            to="/guia"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:scale-105"
          >
            Explorar las guías <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </>
  );
}
