// ============================================================================
// Detalle de un post del blog.
//
// Ruta abierta: sin sesión y sin planes. `getBlogArticleBySlug()` solo devuelve
// piezas `content_type = 'blog'`, así que un artículo de la biblioteca aquí es
// un 404 — Contenido y Blog son secciones separadas y nada vive en las dos.
//
// El cuerpo lo dibuja <ContentBody>, igual que guías y contenido. Lo propio de
// esta ruta es la conversación: debajo del texto van los comentarios moderados.
// ============================================================================
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { ContentBody } from "../components/ContentBody";
import { ArrowLeft, Clock, Loader2, Tag } from "lucide-react";
import { trackEvent, getBlogArticleBySlug } from "../lib/api";
import { BlogComments } from "../components/blog/BlogComments";
import { RecomendacionesRelacionadas } from "../components/content/RecomendacionesRelacionadas";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => await getBlogArticleBySlug(params.slug),
  head: ({ loaderData }) => {
    const a = loaderData?.item;
    return {
      meta: [
        { title: a ? `${a.meta_title ?? a.titulo} — Mente en Foco` : "Artículo — Mente en Foco" },
        {
          name: "description",
          content:
            a?.meta_description ?? a?.resumen_breve ?? "Artículo de bienestar de Mente en Foco.",
        },
        { property: "og:type", content: "article" },
        { property: "og:title", content: a?.titulo ?? "Mente en Foco" },
        { property: "og:description", content: a?.resumen_breve ?? "" },
      ],
    };
  },
  pendingComponent: () => (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="animate-spin text-primary" size={32} />
    </div>
  ),
  component: BlogArticulo,
});


function BlogArticulo() {
  const { item: _b } = Route.useLoaderData();
  useEffect(() => {
    if (_b) trackEvent("BLOG_VIEW", { resource_id: _b.slug, resource_type: "blog" });
  }, [_b]);

  const { item } = Route.useLoaderData();

  if (!item) {
    return (
      <section className="mx-auto flex min-h-[70vh] max-w-4xl flex-col items-center justify-center px-4 py-16 text-center">
        <h1 className="mb-4 text-4xl font-bold text-slate-900">Artículo no encontrado</h1>
        <p className="mb-8 text-slate-500">Este artículo no existe o todavía no está publicado.</p>
        <Link
          to="/blog"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <ArrowLeft size={16} /> Volver al blog
        </Link>
      </section>
    );
  }

  return (
    <div className="reveal-scope">
      <section
        className="relative bg-cover bg-center bg-no-repeat py-20"
        style={
          item.cover_image
            ? { backgroundImage: `url('/contenido/${item.cover_image}')` }
            : undefined
        }
      >
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm" />
        <div className="relative mx-auto max-w-4xl px-4 md:px-6">
          <Link
            to="/blog"
            className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-primary"
          >
            <ArrowLeft size={16} /> Volver al blog
          </Link>
          <div className="mb-4 mt-4 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              <Tag size={12} /> {item.categoria}
            </span>
            {item.tiempo_lectura && (
              <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
                <Clock size={14} /> {item.tiempo_lectura}
              </span>
            )}
          </div>
          <h1 className="mb-2 text-4xl font-bold leading-tight text-slate-900 md:text-5xl">
            {item.titulo}
          </h1>
          <p className="mb-0 text-sm text-slate-500">{item.resumen_breve}</p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-14 md:px-6">
        {item.body_md && (
          <ContentBody markdown={item.body_md} titulo={item.titulo} />
        )}

        {item.clinical_refs && item.clinical_refs.length > 0 && (
          <div className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
              Base de este artículo
            </h2>
            <ul className="mt-3 space-y-2">
              {item.clinical_refs.map((ref, i) => (
                <li key={i} className="text-sm text-slate-600">
                  {ref.fuente}
                  {ref.nota && <span className="block text-xs text-slate-500">{ref.nota}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        <BlogComments postId={item.id} admiteComentarios={item.admite_comentarios} />

        <RecomendacionesRelacionadas
          source="blog"
          currentId={item.slug ?? ""}
          categoria={item.categoria}
          tipoActual="blog"
          themeKey={item.theme_key}
          tags={item.tags}
        />

        <div className="mt-14 rounded-3xl border border-primary/15 bg-primary/5 p-8 text-center">
          <h2 className="text-xl font-bold text-primary">
            Si esto te resonó, hablarlo con alguien ayuda
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Nuestro equipo acompaña procesos como el que acabas de leer, con seguimiento clínico
            real.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/contactanos"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:scale-105"
            >
              Agendar una sesión
            </Link>
            <Link
              to="/guia"
              className="inline-flex items-center gap-2 rounded-xl border border-primary/20 px-6 py-3 text-sm font-bold text-primary transition-colors hover:bg-primary/10"
            >
              Ver las guías
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
