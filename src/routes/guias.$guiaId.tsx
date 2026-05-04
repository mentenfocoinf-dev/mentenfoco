import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Clock, Tag } from "lucide-react";
import { guiasClinicas } from "../data/guiasData";

export const Route = createFileRoute("/guias/$guiaId")({
  head: ({ params }) => {
    const guia = guiasClinicas.find((g) => g.id === params.guiaId);
    return {
      meta: [
        { title: guia ? `${guia.titulo} — Mente en Foco` : "Guía no encontrada — Mente en Foco" },
        { name: "description", content: guia?.descripcionBreve ?? "Guía clínica de bienestar emocional." },
      ],
    };
  },
  component: GuiaDetalle,
});

function GuiaDetalle() {
  const { guiaId } = Route.useParams();
  const guia = guiasClinicas.find((g) => g.id === guiaId);

  if (!guia) {
    return (
      <section className="mx-auto flex min-h-[70vh] max-w-4xl flex-col items-center justify-center px-4 py-16 text-center">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">Guía no encontrada</h1>
        <p className="text-slate-500 mb-8">La guía que buscas no existe o fue removida.</p>
        <Link
          to="/guia"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <ArrowLeft size={16} /> Volver a guías
        </Link>
      </section>
    );
  }

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
            className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-primary transition-colors"
          >
            <ArrowLeft size={16} /> Volver a guías
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-3 mb-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-bold text-primary">
              <Tag size={12} /> {guia.categoria}
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
              <Clock size={14} /> {guia.tiempoLectura}
            </span>
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2 md:text-5xl leading-tight">
            {guia.titulo}
          </h1>
          <p className="text-sm text-slate-500 mb-0">{guia.descripcionBreve}</p>
        </div>
      </section>

      {/* Contenido clínico */}
      <section className="mx-auto max-w-4xl px-4 py-14 md:px-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
            <span className="inline-block w-1 h-6 rounded-full bg-primary" />
            Fundamento clínico
          </h2>
          <div className="text-lg text-slate-700 leading-relaxed whitespace-pre-line mb-10">
            {guia.fundamentoClinico}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
            <span className="inline-block w-1 h-6 rounded-full bg-blue-500" />
            Ejercicio práctico
          </h2>
          <div className="bg-blue-50 border border-blue-100 p-8 rounded-2xl shadow-sm text-lg text-slate-800 leading-relaxed whitespace-pre-line">
            {guia.ejercicioPractico}
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-200 flex items-center justify-between flex-wrap gap-4">
          <Link
            to="/guia"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-primary transition-colors"
          >
            <ArrowLeft size={16} /> Volver a todas las guías
          </Link>
          <Link
            to="/contactanos"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors shadow-md"
          >
            Agendar sesión con un profesional
          </Link>
        </div>
      </section>
    </>
  );
}
