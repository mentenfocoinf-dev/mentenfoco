import { createFileRoute, Link } from "@tanstack/react-router";
import { RevealObserver } from "../components/home/RevealObserver";
import { HeroImagen } from "../components/HeroImagen";
import { BookOpen, FileText, Phone, HelpCircle, ArrowRight, type LucideIcon } from "lucide-react";

// ============================================================================
// Hub de Recursos: índice hacia guías, blog, líneas de crisis y FAQ. Cada
// tarjeta enlaza a una página que existe de verdad; lo que aún no está listo
// (ejercicios descargables) se marca como próximamente, sin enlace roto.
// ============================================================================

export const Route = createFileRoute("/recursos")({
  head: () => ({
    meta: [
      { title: "Recursos — Mente en Foco" },
      {
        name: "description",
        content:
          "Guías clínicas, artículos, líneas de crisis y preguntas frecuentes para acompañarte en tu bienestar.",
      },
    ],
  }),
  component: Recursos,
});

interface ResourceCard {
  icon: LucideIcon;
  title: string;
  desc: string;
  to?: "/guia" | "/blog" | "/lineas-de-crisis" | "/faq";
  soon?: boolean;
}

const RESOURCES: ResourceCard[] = [
  {
    icon: BookOpen,
    title: "Guías de bienestar",
    desc: "Recursos prácticos escritos por nuestro equipo clínico para distintos momentos de tu vida.",
    to: "/guia",
  },
  {
    icon: FileText,
    title: "Blog y artículos",
    desc: "Contenido breve y frecuente sobre salud mental y bienestar emocional.",
    to: "/blog",
  },
  {
    icon: Phone,
    title: "Líneas de crisis",
    desc: "Números de atención gratuita en salud mental y prevención del suicidio en Colombia.",
    to: "/lineas-de-crisis",
  },
  {
    icon: HelpCircle,
    title: "Preguntas frecuentes",
    desc: "Respuestas a las dudas más comunes sobre terapia, planes y privacidad.",
    to: "/faq",
  },
  {
    icon: FileText,
    title: "Ejercicios descargables",
    desc: "Materiales de respiración, relajación y autoestima para practicar en casa.",
    soon: true,
  },
];

function Recursos() {
  return (
    <div className="reveal-scope">
      <RevealObserver />
      <HeroImagen image="/recursos.jpg">
        <div className="mx-auto max-w-4xl px-4 text-center glass-card mx-4 rounded-3xl py-14 shadow-lg border border-white/40">
          <h1 className="text-4xl font-bold text-primary md:text-5xl drop-shadow-sm">Recursos</h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Contenido gratuito para acompañarte, aprender y cuidarte, dentro y fuera de la terapia.
          </p>
        </div>
      </HeroImagen>

      <section className="mx-auto max-w-6xl px-4 py-14 md:px-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {RESOURCES.map((r) => {
            const Icon = r.icon;
            const inner = (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                  <Icon size={22} strokeWidth={1.5} />
                </div>
                <h2 className="mt-4 flex items-center gap-2 text-lg font-bold text-primary">
                  {r.title}
                  {r.soon && (
                    <span className="rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                      Próximamente
                    </span>
                  )}
                </h2>
                <p className="mt-2 flex-1 text-sm text-muted-foreground">{r.desc}</p>
                {!r.soon && (
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-primary">
                    Explorar <ArrowRight size={14} />
                  </span>
                )}
              </>
            );

            if (r.soon) {
              return (
                <div
                  key={r.title}
                  className="rounded-3xl glass-card border border-white/40 p-7 flex flex-col opacity-70"
                >
                  {inner}
                </div>
              );
            }
            return (
              <Link
                key={r.title}
                to={r.to!}
                className="card-neon-hover group rounded-3xl glass-card border border-white/40 p-7 flex flex-col transition-all hover:-translate-y-1"
              >
                {inner}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
