import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Clock, Tag, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuth } from "../hooks/useAuth";
import { PaywallModal } from "../components/PaywallModal";
import { getGuide, PLAN_LABELS } from "../lib/api";

export const Route = createFileRoute("/guias/$guiaId")({
  loader: async ({ params }) => {
    // El servicio intenta traer el contenido completo; si RLS lo bloquea por
    // nivel de plan, devuelve los metadatos (vista pública) para el paywall.
    return await getGuide(params.guiaId);
  },
  head: ({ loaderData }) => {
    const guia = loaderData?.guia ?? loaderData?.meta;
    return {
      meta: [
        { title: guia ? `${guia.titulo} — Mente en Foco` : "Guía no encontrada — Mente en Foco" },
        {
          name: "description",
          content: guia?.descripcionBreve ?? "Guía clínica de bienestar emocional.",
        },
      ],
    };
  },
  pendingComponent: () => (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="animate-spin text-primary" size={32} />
    </div>
  ),
  component: GuiaDetalle,
});

function GuiaDetalle() {
  const { guia, meta } = Route.useLoaderData();
  const { profile } = useAuth();
  const [paywallOpen, setPaywallOpen] = useState(false);

  // Abrir paywall automáticamente si el usuario no tiene acceso a esta guía.
  // No se condiciona a meta.es_premium: hay guías con min_plan='free' que no son
  // de vitrina y siguen bloqueadas para cuentas gratuitas/anónimas — antes esas
  // caían al bloque de "guía no encontrada" en vez de mostrar el paywall.
  useEffect(() => {
    if (!guia && meta) {
      setPaywallOpen(true);
    }
  }, [guia, meta]);

  // Protección de Propiedad Intelectual (solo para guías con contenido accesible)
  useEffect(() => {
    if (!guia) return;

    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J" || e.key === "C")) ||
        (e.ctrlKey &&
          (e.key === "U" || e.key === "S" || e.key === "P" || e.key === "c" || e.key === "C")) ||
        (e.metaKey && e.altKey && (e.key === "I" || e.key === "J" || e.key === "U")) ||
        (e.metaKey &&
          (e.key === "s" ||
            e.key === "S" ||
            e.key === "p" ||
            e.key === "P" ||
            e.key === "c" ||
            e.key === "C"))
      ) {
        e.preventDefault();
      }
    };
    const handleCopy = (e: ClipboardEvent) => e.preventDefault();
    const handleDragStart = (e: DragEvent) => e.preventDefault();

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("dragstart", handleDragStart);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("dragstart", handleDragStart);
    };
  }, [guia]);

  // ── Caso: guía bloqueada para este viewer ────────────────────────────────
  // Se llega aquí tanto por una guía realmente premium (min_plan='esencial')
  // como por una guía estructuralmente 'free' que no es de vitrina y el viewer
  // es una cuenta gratuita/anónima. En ambos casos el plan que de verdad
  // desbloquea el contenido es el más económico de pago: si meta.min_plan viene
  // en 'free' es porque el bloqueo es por vitrina, no por el plan de la guía.
  if (!guia && meta) {
    const requiredPlan = meta.min_plan === "free" ? "esencial" : meta.min_plan;
    return (
      <>
        <PaywallModal
          isOpen={paywallOpen}
          onOpenChange={setPaywallOpen}
          requiredPlan={requiredPlan}
        />
        <section
          className="relative bg-cover bg-center bg-no-repeat py-20"
          style={{ backgroundImage: `url('/guias/${meta.imageName}')` }}
        >
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm" />
          <div className="relative mx-auto max-w-4xl px-4 md:px-6">
            <Link
              to="/guia"
              className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-primary"
            >
              <ArrowLeft size={16} /> Volver a guías
            </Link>
            <div className="mb-4 mt-4 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
                Premium
              </span>
            </div>
            <h1 className="mb-2 text-4xl font-bold leading-tight text-slate-900 md:text-5xl">
              {meta.titulo}
            </h1>
            <p className="mb-0 text-sm text-slate-500">{meta.descripcionBreve}</p>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 py-14 md:px-6">
          {/* Vista previa borrosa del contenido */}
          <div className="relative overflow-hidden rounded-3xl">
            <div className="select-none blur-sm pointer-events-none">
              <p className="text-slate-700 leading-relaxed">
                Este contenido clínico incluye protocolos terapéuticos avanzados, ejercicios de
                terapia cognitivo-conductual, técnicas de regulación emocional y materiales
                descargables exclusivos desarrollados por nuestro equipo de especialistas...
              </p>
              <p className="mt-4 text-slate-700 leading-relaxed">
                Con evidencia científica validada, esta guía te proporciona herramientas prácticas
                para aplicar en tu día a día, con seguimiento clínico estructurado paso a paso...
              </p>
            </div>
            {/* Overlay de bloqueo */}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-white/20 to-white/95 rounded-3xl">
              <div className="text-center px-6">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Contenido Premium</h2>
                <p className="text-sm text-slate-600 mb-6 max-w-sm mx-auto">
                  Esta guía está disponible desde el{" "}
                  <strong className="text-primary">{PLAN_LABELS[requiredPlan]}</strong> en
                  adelante.
                </p>
                <button
                  onClick={() => setPaywallOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-lg transition-all hover:-translate-y-0.5 hover:bg-primary/90"
                >
                  Ver planes de membresía
                </button>
              </div>
            </div>
          </div>
        </section>
      </>
    );
  }

  // ── Caso: guía no encontrada (no existe) ─────────────────────────────────
  if (!guia) {
    return (
      <section className="mx-auto flex min-h-[70vh] max-w-4xl flex-col items-center justify-center px-4 py-16 text-center">
        <h1 className="mb-4 text-4xl font-bold text-slate-900">Guía no encontrada</h1>
        <p className="mb-8 text-slate-500">
          La guía que buscas no existe o fue removida.
        </p>
        <Link
          to="/guia"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <ArrowLeft size={16} /> Volver a guías
        </Link>
      </section>
    );
  }

  // ── Caso: guía accesible ──────────────────────────────────────────────────
  const oldContent = `
## Fundamento clínico
${guia.fundamentoClinico}

---

## Ejercicio Práctico
${guia.ejercicioPractico}
  `;

  const contentToRender = guia.contenidoCompleto ? guia.contenidoCompleto : oldContent;

  return (
    <>
      {/* Hero con imagen dinámica */}
      <section
        className="relative bg-cover bg-center bg-no-repeat py-20"
        style={{ backgroundImage: `url('/guias/${guia.imageName}')` }}
      >
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm" />
        <div className="relative mx-auto max-w-4xl px-4 md:px-6">
          <Link
            to="/guia"
            className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-primary"
          >
            <ArrowLeft size={16} /> Volver a guías
          </Link>
          <div className="mb-4 mt-4 flex flex-wrap items-center gap-3">
            {guia.etiquetas?.map((tag: string) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold text-primary"
              >
                <Tag size={12} /> {tag}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
              <Clock size={14} /> {guia.tiempoLectura}
            </span>
            {guia.es_premium && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
                Premium
              </span>
            )}
          </div>
          <h1 className="mb-2 text-4xl font-bold leading-tight text-slate-900 md:text-5xl">
            {guia.titulo}
          </h1>
          <p className="mb-0 text-sm text-slate-500">{guia.descripcionBreve}</p>
        </div>
      </section>

      {/* Contenido clínico protegido */}
      <section
        className="mx-auto max-w-4xl px-4 py-14 md:px-6 select-none"
        style={{ WebkitTouchCallout: "none" }}
      >
        <div className="relative">
          <article className="prose prose-slate prose-lg max-w-none mx-auto prose-headings:text-slate-900 prose-headings:font-bold prose-headings:tracking-tight prose-p:leading-relaxed prose-p:text-slate-700 prose-a:text-primary hover:prose-a:text-primary/80 prose-img:rounded-xl prose-img:shadow-md prose-li:text-slate-700 transition-all duration-700">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                table: ({ node, ...props }) => (
                  <div className="not-prose w-full overflow-x-auto rounded-xl border border-slate-200 shadow-sm my-10 bg-white">
                    <table className="w-full text-sm text-left border-collapse" {...props} />
                  </div>
                ),
                thead: ({ node, ...props }) => (
                  <thead className="bg-slate-50 border-b border-slate-200" {...props} />
                ),
                th: ({ node, ...props }) => (
                  <th className="p-4 font-bold text-slate-900 whitespace-nowrap" {...props} />
                ),
                td: ({ node, ...props }) => (
                  <td
                    className="p-4 border-b border-slate-100 text-slate-700 align-top"
                    {...props}
                  />
                ),
                tr: ({ node, ...props }) => (
                  <tr className="hover:bg-slate-50/50 transition-colors last:border-0" {...props} />
                ),
              }}
            >
              {contentToRender}
            </ReactMarkdown>
          </article>
        </div>

        <div className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-8">
          <Link
            to="/guia"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-primary"
          >
            <ArrowLeft size={16} /> Volver a todas las guías
          </Link>
          <Link
            to="/contactanos"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-md transition-colors hover:bg-primary/90"
          >
            Agendar sesión con un profesional
          </Link>
        </div>
      </section>
    </>
  );
}
