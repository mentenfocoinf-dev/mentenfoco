import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect } from "react";
import { HeroImagen } from "../components/HeroImagen";
import { trackEvent } from "../lib/api";
import {
  ArrowRight,
  Brain,
  HeartHandshake,
  Stethoscope,
  MessageSquare,
  Users,
  Baby,
  Check,
  type LucideIcon,
} from "lucide-react";

// ============================================================================
// Landings de servicio, una por disciplina. Contenido estático y sobrio: describe
// qué es cada servicio, para quién y cómo acompaña, sin cifras ni afirmaciones
// que no se puedan sostener. El CTA lleva a agendar (contactanos → crm_leads).
// ============================================================================

interface Service {
  slug: string;
  icon: LucideIcon;
  title: string;
  /** Fotografía de cabecera en public/servicios/. Sin ella cae al banner genérico. */
  image?: string;
  tagline: string;
  intro: string;
  paraQuien: string[];
  comoAyuda: string[];
  // Estado real del servicio en la operación. Los que hoy la plataforma ya
  // presenta como disciplinas propias van como "activo"; los que todavía se
  // están consolidando se marcan para no afirmar una trayectoria inexistente.
  enPreparacion?: boolean;
}

const SERVICES: Record<string, Service> = {
  "psicologia-clinica": {
    slug: "psicologia-clinica",
    icon: HeartHandshake,
    title: "Psicología Clínica",
    image: "/servicios/psicologia-clinica.jpg",
    tagline: "Terapia enfocada en darte herramientas prácticas para tu día a día.",
    intro:
      "La psicología clínica trabaja sobre lo que sientes, piensas y haces para ayudarte a entender qué te ocurre y a construir formas más sanas de afrontarlo. No es solo hablar: es un proceso estructurado, con objetivos claros y seguimiento de tu avance.",
    paraQuien: [
      "Ansiedad, estrés sostenido o preocupación difícil de controlar.",
      "Estados de ánimo bajos, desmotivación o tristeza persistente.",
      "Momentos de cambio o duelo que cuesta atravesar solo.",
      "Dificultades en relaciones, autoestima o manejo de emociones.",
    ],
    comoAyuda: [
      "Valoración inicial para entender tu situación a fondo.",
      "Un plan de trabajo con objetivos definidos, no sesiones sueltas.",
      "Técnicas basadas en evidencia adaptadas a lo que necesitas.",
      "Seguimiento de tu evolución con instrumentos clínicos validados.",
    ],
  },
  neuropsicologia: {
    slug: "neuropsicologia",
    icon: Brain,
    title: "Neuropsicología",
    image: "/servicios/neuropsicologia.jpg",
    tagline: "Evaluación y cuidado de la relación entre tu cerebro y tu conducta.",
    intro:
      "La neuropsicología evalúa funciones como la memoria, la atención, el lenguaje y las funciones ejecutivas, y cómo se relacionan con tu vida diaria. Es el corazón del enfoque clínico de Mente en Foco: acompañamos a niños, adultos y personas mayores con una mirada estructurada del funcionamiento cognitivo.",
    paraQuien: [
      "Cambios en memoria o atención que te preocupan.",
      "Dificultades de aprendizaje o de desarrollo en niños.",
      "Seguimiento de deterioro cognitivo en personas mayores.",
      "Necesidad de una valoración cognitiva estructurada.",
    ],
    comoAyuda: [
      "Valoración con pruebas de cribado estandarizadas (p. ej. MoCA, MMSE).",
      "Informe clínico con hallazgos y recomendaciones concretas.",
      "Plan de estimulación o rehabilitación cognitiva según el caso.",
      "Acompañamiento a la familia cuando hace falta.",
    ],
  },
  psiquiatria: {
    slug: "psiquiatria",
    icon: Stethoscope,
    title: "Psiquiatría",
    image: "/servicios/psiquiatria.jpg",
    tagline: "Atención médica especializada cuando se requiere apoyo farmacológico.",
    intro:
      "La psiquiatría es la rama médica de la salud mental. Evalúa y trata con rigor científico los casos en los que, junto al acompañamiento psicológico, puede ser útil un abordaje farmacológico. Siempre con evaluación cuidadosa y decisiones compartidas contigo.",
    paraQuien: [
      "Cuadros que no mejoran solo con acompañamiento psicológico.",
      "Necesidad de evaluar si un tratamiento farmacológico puede ayudar.",
      "Seguimiento médico de un tratamiento ya iniciado.",
      "Casos que requieren una mirada médica integral.",
    ],
    comoAyuda: [
      "Evaluación médica de tu situación y antecedentes.",
      "Explicación clara de opciones, con sus beneficios y riesgos.",
      "Trabajo conjunto con tu psicólogo para un plan integrado.",
      "Seguimiento cercano de cómo respondes al tratamiento.",
    ],
  },
  fonoaudiologia: {
    slug: "fonoaudiologia",
    icon: MessageSquare,
    title: "Fonoaudiología",
    tagline: "Apoyo profesional en comunicación, lenguaje y aprendizaje.",
    intro:
      "La fonoaudiología trabaja sobre la comunicación, el lenguaje y funciones relacionadas. Acompañamos a quienes enfrentan dificultades para hablar, comprender, leer o tragar, buscando mejorar su autonomía y su integración en el día a día.",
    paraQuien: [
      "Dificultades del lenguaje o del habla en niños.",
      "Retrasos en la comunicación o el aprendizaje.",
      "Alteraciones de la voz o de la deglución en adultos.",
      "Rehabilitación tras un evento neurológico.",
    ],
    comoAyuda: [
      "Valoración del área de comunicación o deglución afectada.",
      "Plan de intervención con ejercicios y metas claras.",
      "Trabajo coordinado con neuropsicología cuando corresponde.",
      "Orientación a la familia para reforzar en casa.",
    ],
  },
  "terapia-pareja": {
    slug: "terapia-pareja",
    icon: Users,
    title: "Terapia de Pareja",
    tagline: "Un espacio para reconstruir la comunicación y la conexión.",
    intro:
      "La terapia de pareja ofrece un espacio neutral y confidencial para trabajar la comunicación, los conflictos recurrentes y la forma de relacionarse. El objetivo no es decidir por ustedes, sino darles herramientas para entenderse mejor y tomar sus propias decisiones.",
    paraQuien: [
      "Conflictos que se repiten sin llegar a acuerdos.",
      "Dificultades de comunicación o distancia emocional.",
      "Momentos de crisis o cambios importantes en la relación.",
      "Deseo de fortalecer el vínculo antes de que escale un problema.",
    ],
    comoAyuda: [
      "Un espacio seguro, sin tomar partido por ninguno.",
      "Herramientas concretas de comunicación asertiva.",
      "Trabajo sobre patrones que alimentan el conflicto.",
      "Acompañamiento a su propio ritmo y sus propias metas.",
    ],
    enPreparacion: true,
  },
  "orientacion-padres": {
    slug: "orientacion-padres",
    icon: Baby,
    title: "Orientación para Padres",
    tagline: "Acompañamiento para criar con más herramientas y menos culpa.",
    intro:
      "La orientación para padres acompaña a las familias en los retos de la crianza: límites, regulación emocional, pantallas, berrinches, autonomía. No se trata de recetas únicas, sino de entender a tu hijo y encontrar formas de acompañarlo que funcionen para tu familia.",
    paraQuien: [
      "Dudas sobre límites, rutinas o manejo de berrinches.",
      "Dificultades emocionales o de conducta en los niños.",
      "Momentos de cambio familiar que afectan a los hijos.",
      "Deseo de criar desde el conocimiento y no solo la intuición.",
    ],
    comoAyuda: [
      "Orientación práctica adaptada a la edad de tu hijo.",
      "Estrategias de regulación emocional para toda la familia.",
      "Coordinación con neuropsicología cuando hay dificultades de desarrollo.",
      "Un espacio sin juicios para resolver tus dudas.",
    ],
    enPreparacion: true,
  },
};

export const SERVICE_SLUGS = Object.keys(SERVICES);
export const SERVICE_MENU = Object.values(SERVICES).map((s) => ({
  slug: s.slug,
  title: s.title,
  enPreparacion: s.enPreparacion ?? false,
}));

export const Route = createFileRoute("/servicios/$slug")({
  loader: ({ params }) => {
    const service = SERVICES[params.slug];
    if (!service) throw notFound();
    return { service };
  },
  head: ({ loaderData }) => {
    const s = loaderData?.service;
    return {
      meta: [
        { title: s ? `${s.title} — Mente en Foco` : "Servicio — Mente en Foco" },
        { name: "description", content: s?.tagline ?? "Servicios clínicos de Mente en Foco." },
      ],
    };
  },
  component: ServicioDetalle,
});

function ServicioDetalle() {
  const { service: _s } = Route.useLoaderData();
  useEffect(() => {
    if (_s) trackEvent("SERVICES_VIEW", { resource_id: _s.slug });
  }, [_s]);

  const { service } = Route.useLoaderData();
  const Icon = service.icon;

  return (
    <>
      <HeroImagen image={service.image ?? "/BANNER.jpg"}>
        <div className="mx-auto max-w-4xl px-4 text-center glass-card mx-4 rounded-3xl py-14 shadow-lg border border-white/40">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20">
            <Icon size={30} strokeWidth={1.5} />
          </div>
          <h1 className="mt-6 text-4xl font-bold text-primary md:text-5xl drop-shadow-sm">
            {service.title}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">{service.tagline}</p>
          {service.enPreparacion && (
            <p className="mx-auto mt-4 inline-block rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-xs font-semibold text-amber-700">
              Servicio en preparación — consulta disponibilidad
            </p>
          )}
        </div>
      </HeroImagen>

      <section className="mx-auto max-w-4xl px-4 py-14 md:px-6">
        <p className="text-lg leading-relaxed text-foreground/80">{service.intro}</p>

        <div className="mt-12 grid gap-8 md:grid-cols-2">
          <div className="card-neon-hover rounded-3xl glass-card p-8 border border-white/40">
            <h2 className="text-xl font-bold text-primary">¿Para quién es?</h2>
            <ul className="mt-4 space-y-3">
              {service.paraQuien.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-foreground/80">
                  <Check size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="card-neon-hover rounded-3xl glass-card p-8 border border-white/40">
            <h2 className="text-xl font-bold text-primary">Cómo te acompañamos</h2>
            <ul className="mt-4 space-y-3">
              {service.comoAyuda.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-foreground/80">
                  <Check size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 rounded-3xl bg-primary/5 border border-primary/10 p-10 text-center">
          <h2 className="text-2xl font-bold text-primary">Da el primer paso</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
            Cuéntanos qué necesitas y te orientamos sobre el mejor camino para ti. La valoración
            inicial define juntos cómo seguir.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/contactanos"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:scale-105"
            >
              Agendar valoración <ArrowRight size={16} />
            </Link>
            <Link
              to="/asesoramiento"
              className="inline-flex items-center gap-2 rounded-xl border border-primary/20 px-6 py-3 text-sm font-bold text-primary transition-colors hover:bg-primary/10"
            >
              Ver planes
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
