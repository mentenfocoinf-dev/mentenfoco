import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Clock, Tag, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { ContentBody } from "../components/ContentBody";
import { RecomendacionesRelacionadas } from "../components/content/RecomendacionesRelacionadas";
import { trackEvent, getGuide } from "../lib/api";

export const Route = createFileRoute("/guias/$guiaId")({
  loader: async ({ params }) => {
    // El servicio solo devuelve la guía si el plan del viewer la incluye; si no,
    // no existe para él y cae en "guía no encontrada". Nunca hay pantalla de pago.
    return await getGuide(params.guiaId);
  },
  head: ({ loaderData }) => {
    const guia = loaderData?.guia;
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
  const { guia: _g } = Route.useLoaderData();
  useEffect(() => {
    if (_g) trackEvent("GUIDE_VIEW", { resource_id: _g.id, resource_type: "guia" });
  }, [_g]);

  const { guia } = Route.useLoaderData();

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
    <div className="reveal-scope">
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
          <ContentBody
            markdown={contentToRender}
            titulo={guia.titulo}
            className="transition-all duration-700"
          />
        </div>

        <RecomendacionesRelacionadas
          source="guia"
          currentId={guia.id}
          categoria={guia.categoria}
          tipoActual="guia"
          themeKey={guia.theme_key}
          tags={guia.etiquetas}
        />

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
    </div>
  );
}
