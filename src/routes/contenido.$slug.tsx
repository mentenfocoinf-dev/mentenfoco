// ============================================================================
// Detalle de una pieza de contenido publicada.
//
// El render se ramifica por content_type (artículo / programa / herramienta /
// audio), pero el cuerpo lo dibuja <ContentBody>, el mismo lector que usan las
// guías y el blog. No hay bloqueo por plan: si la pieza no corresponde al plan
// del viewer, getContentBySlug() no la devuelve y esto es un "no encontrado".
// ============================================================================
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { ContentBody } from "../components/ContentBody";
import { RecomendacionesRelacionadas } from "../components/content/RecomendacionesRelacionadas";
import { JourneyNextStep } from "../components/journey/JourneyNextStep";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  Headphones,
  Loader2,
  Route as RouteIcon,
  Tag,
  Wrench,
} from "lucide-react";
import { trackEvent, getContentBySlug, CONTENT_TYPE_LABELS, type ContentType } from "../lib/api";

export const Route = createFileRoute("/contenido/$slug")({
  loader: async ({ params }) => await getContentBySlug(params.slug),
  head: ({ loaderData }) => {
    const t = loaderData?.item?.titulo;
    return {
      meta: [
        { title: t ? `${t} — Mente en Foco` : "Contenido — Mente en Foco" },
        {
          name: "description",
          content: loaderData?.item?.resumen_breve ?? "Contenido de bienestar de Mente en Foco.",
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
  blog: BookOpen, // no se usa aquí: /contenido nunca lista piezas de blog

  articulo: BookOpen,
  programa: RouteIcon,
  herramienta: Wrench,
  audio: Headphones,
};


function ContenidoDetalle() {
  const { item: _i } = Route.useLoaderData();
  useEffect(() => {
    if (_i) trackEvent("CONTENT_VIEW", { resource_id: _i.slug, resource_type: _i.content_type });
  }, [_i]);

  const { item, reachableSteps } = Route.useLoaderData();
  // Un paso solo es enlace si su destino está dentro del plan del lector; si no,
  // el enlace terminaría en "no encontrado". Ver resolveReachableSteps().
  const alcanzable = new Set(reachableSteps);

  if (!item) {
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

  const doc = item;
  const hasAudioSource = Boolean(doc.audio_url || doc.external_embed_url);

  return (
    <div className="reveal-scope">
      <Hero meta={doc} />

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
          <ContentBody markdown={doc.body_md} titulo={doc.titulo} />
        )}

        {/* PROGRAMA: "tu siguiente paso" antes del mapa completo de la ruta.
            Aquí el motor de recomendaciones está apagado (C1), así que no compiten. */}
        {doc.content_type === "programa" && (
          <JourneyNextStep
            programaId={doc.slug ?? ""}
            steps={doc.program_steps}
            alcanzables={reachableSteps}
          />
        )}

        {/* PROGRAMA: pasos ordenados, cada uno puede enlazar a otra pieza */}
        {doc.content_type === "programa" && doc.program_steps && doc.program_steps.length > 0 && (
          <div className="mt-12">
            <h2 className="mb-5 text-2xl font-bold text-primary">Cómo funciona</h2>
            <ol className="space-y-4">
              {[...doc.program_steps]
                .sort((a, b) => a.orden - b.orden)
                .map((step) => {
                  // Un paso puede enlazar a otra pieza de contenido o a una guía
                  // clínica; el seed marcó cuál en ref_kind. Sin referencia —o
                  // con un destino fuera del plan del lector— el paso se muestra
                  // igual pero sin enlace (ej. "haz tu GAD-7").
                  const enlazable =
                    Boolean(step.slug_relacionado) && alcanzable.has(step.slug_relacionado as string);
                  const body = (
                    <>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                        {step.orden}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold text-slate-800">{step.titulo}</span>
                        {step.descripcion && (
                          <span className="mt-1 block text-sm text-slate-600">
                            {step.descripcion}
                          </span>
                        )}
                      </span>
                    </>
                  );

                  const linkClasses =
                    "glow-hover group flex w-full gap-4 rounded-2xl border border-white/60 bg-white/60 p-5 text-left shadow-sm";

                  if (enlazable && step.ref_kind === "contenido") {
                    return (
                      <li key={`${step.orden}-${step.titulo}`}>
                        <Link
                          to="/contenido/$slug"
                          params={{ slug: step.slug_relacionado as string }}
                          className={linkClasses}
                        >
                          {body}
                          <ArrowLeft
                            size={16}
                            className="mt-1 shrink-0 rotate-180 text-primary transition-transform group-hover:translate-x-1"
                          />
                        </Link>
                      </li>
                    );
                  }

                  if (enlazable && step.ref_kind === "guia") {
                    return (
                      <li key={`${step.orden}-${step.titulo}`}>
                        <Link
                          to="/guias/$guiaId"
                          params={{ guiaId: step.slug_relacionado as string }}
                          className={linkClasses}
                        >
                          {body}
                          <ArrowLeft
                            size={16}
                            className="mt-1 shrink-0 rotate-180 text-primary transition-transform group-hover:translate-x-1"
                          />
                        </Link>
                      </li>
                    );
                  }

                  return (
                    <li
                      key={`${step.orden}-${step.titulo}`}
                      className="flex gap-4 rounded-2xl border border-white/60 bg-white/60 p-5 shadow-sm"
                    >
                      {body}
                    </li>
                  );
                })}
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

        <RecomendacionesRelacionadas
          source="contenido"
          currentId={doc.slug ?? ""}
          categoria={doc.categoria}
          tipoActual={doc.content_type}
          themeKey={doc.theme_key}
          tags={doc.tags}
        />

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
    </div>
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
