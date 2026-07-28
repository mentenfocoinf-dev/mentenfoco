// ============================================================================
// Detalle de una pieza de contenido publicada.
//
// El render se ramifica por content_type (artículo / programa / herramienta /
// audio), pero el markdown se renderiza con el mismo ReactMarkdown + remark-gfm
// que ya usan las guías, y el bloqueo por plan usa el mismo PaywallModal.
// ============================================================================
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  Headphones,
  Loader2,
  Lock,
  Route as RouteIcon,
  Tag,
  Wrench,
} from "lucide-react";
import { PaywallModal } from "../components/PaywallModal";
import {
  getContentBySlug,
  CONTENT_TYPE_LABELS,
  PLAN_LABELS,
  type ContentType,
} from "../lib/api";

export const Route = createFileRoute("/contenido/$slug")({
  loader: async ({ params }) => await getContentBySlug(params.slug),
  head: ({ loaderData }) => {
    const t = loaderData?.item?.titulo ?? loaderData?.meta?.titulo;
    return {
      meta: [
        { title: t ? `${t} — Mente en Foco` : "Contenido — Mente en Foco" },
        {
          name: "description",
          content: loaderData?.meta?.resumen_breve ?? "Contenido de bienestar de Mente en Foco.",
        },
      ],
    };
  },
  pendingComponent: () => (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="animate-spin text-primary" size={32} />
    </div>
  ),
  component: ContenidoDetalle,
});

const TYPE_ICON: Record<ContentType, typeof BookOpen> = {
  articulo: BookOpen,
  programa: RouteIcon,
  herramienta: Wrench,
  audio: Headphones,
};

const MD_COMPONENTS = {
  table: ({ node: _n, ...props }: any) => (
    <div className="not-prose my-10 w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full border-collapse text-left text-sm" {...props} />
    </div>
  ),
  thead: ({ node: _n, ...props }: any) => (
    <thead className="border-b border-slate-200 bg-slate-50" {...props} />
  ),
  th: ({ node: _n, ...props }: any) => (
    <th className="whitespace-nowrap p-4 font-bold text-slate-900" {...props} />
  ),
  td: ({ node: _n, ...props }: any) => (
    <td className="border-b border-slate-100 p-4 align-top text-slate-700" {...props} />
  ),
};

function ContenidoDetalle() {
  const { item, meta } = Route.useLoaderData();
  const [paywallOpen, setPaywallOpen] = useState(false);

  // Sin cuerpo pero con metadatos = el plan no alcanza.
  useEffect(() => {
    if (!item && meta) setPaywallOpen(true);
  }, [item, meta]);

  if (!item && !meta) {
    return (
      <section className="mx-auto flex min-h-[70vh] max-w-4xl flex-col items-center justify-center px-4 py-16 text-center">
        <h1 className="mb-4 text-4xl font-bold text-slate-900">Contenido no encontrado</h1>
        <p className="mb-8 text-slate-500">Esta pieza no existe o todavía no está publicada.</p>
        <Link
          to="/contenido"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <ArrowLeft size={16} /> Volver a contenido
        </Link>
      </section>
    );
  }

  // ── Bloqueado por plan ────────────────────────────────────────────────────
  if (!item && meta) {
    const requiredPlan = meta.min_plan === "free" ? "esencial" : meta.min_plan;
    return (
      <>
        <PaywallModal
          isOpen={paywallOpen}
          onOpenChange={setPaywallOpen}
          requiredPlan={requiredPlan}
        />
        <Hero meta={meta} />
        <section className="mx-auto max-w-4xl px-4 py-14 md:px-6">
          <div className="relative overflow-hidden rounded-3xl">
            <div className="pointer-events-none select-none blur-sm">
              <p className="leading-relaxed text-slate-700">{meta.resumen_breve}</p>
              <p className="mt-4 leading-relaxed text-slate-700">
                El contenido completo de esta pieza está disponible para los planes de
                acompañamiento…
              </p>
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl bg-gradient-to-b from-white/20 to-white/95">
              <div className="px-6 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                  <Lock size={28} />
                </div>
                <h2 className="mb-2 text-xl font-bold text-slate-900">Contenido de plan</h2>
                <p className="mx-auto mb-6 max-w-sm text-sm text-slate-600">
                  Disponible desde el{" "}
                  <strong className="text-primary">{PLAN_LABELS[requiredPlan]}</strong> en adelante.
                </p>
                <button
                  onClick={() => setPaywallOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-lg transition-all hover:-translate-y-0.5 hover:bg-primary/90"
                >
                  Ver planes
                </button>
              </div>
            </div>
          </div>
        </section>
      </>
    );
  }

  const doc = item!;
  const hasAudioSource = Boolean(doc.audio_url || doc.external_embed_url);

  return (
    <>
      <Hero meta={meta ?? doc} />

      <section className="mx-auto max-w-4xl px-4 py-14 md:px-6">
        {/* AUDIO: reproductor si existe; si no, el resumen ya aporta valor solo */}
        {doc.content_type === "audio" && (
          <div className="mb-10">
            {hasAudioSource ? (
              doc.external_embed_url ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                  <iframe
                    src={doc.external_embed_url}
                    title={doc.titulo}
                    allow="autoplay; encrypted-media"
                    className="h-[352px] w-full"
                  />
                </div>
              ) : (
                <audio controls src={doc.audio_url ?? undefined} className="w-full">
                  Tu navegador no puede reproducir este audio.
                </audio>
              )
            ) : (
              <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <Headphones size={20} className="shrink-0 text-amber-700" />
                <div>
                  <p className="text-sm font-bold text-amber-800">Audio próximamente</p>
                  <p className="text-xs text-amber-700">
                    La grabación está en producción. Mientras tanto, abajo tienes el tema completo.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ARTÍCULO: bloque "En resumen" antes del cuerpo */}
        {doc.en_resumen && doc.en_resumen.length > 0 && (
          <div className="mb-10 rounded-3xl border border-primary/20 bg-primary/5 p-6">
            <h2 className="mb-3 text-lg font-bold text-primary">En resumen</h2>
            <ul className="space-y-2">
              {doc.en_resumen.map((line, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Cuerpo markdown — mismo renderizado que las guías */}
        {doc.body_md && (
          <article className="prose prose-slate prose-lg mx-auto max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-slate-900 prose-p:leading-relaxed prose-p:text-slate-700 prose-a:text-primary hover:prose-a:text-primary/80 prose-li:text-slate-700 prose-img:rounded-xl prose-img:shadow-md">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
              {doc.body_md}
            </ReactMarkdown>
          </article>
        )}

        {/* PROGRAMA: pasos ordenados, cada uno puede enlazar a otra pieza */}
        {doc.content_type === "programa" && doc.program_steps && doc.program_steps.length > 0 && (
          <div className="mt-12">
            <h2 className="mb-5 text-2xl font-bold text-primary">Cómo funciona</h2>
            <ol className="space-y-4">
              {[...doc.program_steps]
                .sort((a, b) => a.orden - b.orden)
                .map((step) => (
                  <li
                    key={`${step.orden}-${step.titulo}`}
                    className="flex gap-4 rounded-2xl border border-white/60 bg-white/60 p-5 shadow-sm"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                      {step.orden}
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800">{step.titulo}</p>
                      {step.descripcion && (
                        <p className="mt-1 text-sm text-slate-600">{step.descripcion}</p>
                      )}
                    </div>
                  </li>
                ))}
            </ol>
          </div>
        )}

        {/* FAQ */}
        {doc.faq && doc.faq.length > 0 && (
          <div className="mt-12">
            <h2 className="mb-5 text-2xl font-bold text-primary">Preguntas frecuentes</h2>
            <div className="space-y-3">
              {doc.faq.map((entry, i) => (
                <details
                  key={i}
                  className="group rounded-2xl border border-white/60 bg-white/60 [&_summary::-webkit-details-marker]:hidden"
                >
                  <summary className="flex cursor-pointer items-center justify-between gap-4 p-4 font-semibold text-slate-800">
                    {entry.q}
                    <span className="text-primary transition duration-300 group-open:-rotate-180">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </span>
                  </summary>
                  <p className="px-4 pb-4 text-sm leading-relaxed text-slate-600">{entry.a}</p>
                </details>
              ))}
            </div>
          </div>
        )}

        {/* Cierre destacado */}
        {doc.key_takeaway && (
          <div className="mt-12 rounded-3xl border-l-4 border-primary bg-primary/5 p-6">
            <p className="text-lg font-semibold leading-relaxed text-slate-800">
              {doc.key_takeaway}
            </p>
          </div>
        )}

        {/* Fundamentación */}
        {doc.clinical_refs && doc.clinical_refs.length > 0 && (
          <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="mb-2 text-sm font-bold text-slate-700">Fundamentación</h3>
            <ul className="space-y-1.5">
              {doc.clinical_refs.map((ref, i) => (
                <li key={i} className="text-xs leading-relaxed text-slate-500">
                  <span className="font-semibold text-slate-600">{ref.fuente}</span>
                  {ref.nota ? ` — ${ref.nota}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Aviso legal + crisis. El número vive solo en /lineas-de-crisis. */}
        <div className="mt-10 rounded-2xl border border-slate-200 bg-white/60 p-5">
          <p className="text-xs leading-relaxed text-slate-500">
            Este contenido es informativo y no reemplaza la atención de un profesional. Si estás
            atravesando una crisis, consulta las{" "}
            <Link to="/lineas-de-crisis" className="font-semibold text-primary hover:underline">
              líneas de atención disponibles
            </Link>
            .
          </p>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-8">
          <Link
            to="/contenido"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-primary"
          >
            <ArrowLeft size={16} /> Volver a contenido
          </Link>
          <Link
            to="/contactanos"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-md transition-colors hover:bg-primary/90"
          >
            Agendar con un profesional
          </Link>
        </div>
      </section>
    </>
  );
}

function Hero({ meta }: { meta: { titulo: string; resumen_breve: string; categoria: string; content_type: ContentType; cover_image: string | null; tiempo_lectura: string | null; tags?: string[] | null } }) {
  const Icon = TYPE_ICON[meta.content_type] ?? BookOpen;
  return (
    <section
      className="relative bg-cover bg-center bg-no-repeat py-20"
      style={
        meta.cover_image ? { backgroundImage: `url('/contenido/${meta.cover_image}')` } : undefined
      }
    >
      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm" />
      <div className="relative mx-auto max-w-4xl px-4 md:px-6">
        <Link
          to="/contenido"
          className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-primary"
        >
          <ArrowLeft size={16} /> Volver a contenido
        </Link>
        <div className="mb-4 mt-4 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            <Icon size={12} /> {CONTENT_TYPE_LABELS[meta.content_type]}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
            <Tag size={12} /> {meta.categoria}
          </span>
          {meta.tiempo_lectura && (
            <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
              <Clock size={14} /> {meta.tiempo_lectura}
            </span>
          )}
        </div>
        <h1 className="mb-2 text-4xl font-bold leading-tight text-slate-900 md:text-5xl">
          {meta.titulo}
        </h1>
        <p className="mb-0 text-sm text-slate-500">{meta.resumen_breve}</p>
      </div>
    </section>
  );
}
