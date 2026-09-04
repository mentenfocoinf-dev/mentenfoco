import { createFileRoute, Link } from "@tanstack/react-router";
import { RevealObserver } from "../components/home/RevealObserver";
import { faqLd } from "../lib/seo";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

// ============================================================================
// Preguntas frecuentes, contenido estático y categorizado. Solo respuestas que
// se sostienen con lo que la plataforma ya hace hoy. Lo que depende de una
// decisión de negocio aún no cerrada (política de cambio de terapeuta, sesión
// gratuita de orientación) se deja fuera para no prometer algo sin definir.
// ============================================================================

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "Preguntas frecuentes — Mente en Foco" },
      {
        name: "description",
        content: "Resolvemos las dudas más comunes sobre terapia, planes, privacidad y más.",
      },
    ],
    // FAQPage: solo las respuestas de texto (algunas son JSX y se omiten).
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(
          faqLd(
            CATEGORIES.flatMap((c) => c.items)
              .filter((it) => typeof it.a === "string")
              .map((it) => ({ q: it.q, a: it.a as string })),
          ),
        ),
      },
    ],
  }),
  component: Faq,
});

interface QA {
  q: string;
  a: React.ReactNode;
}

const CATEGORIES: { title: string; items: QA[] }[] = [
  {
    title: "Sobre la terapia",
    items: [
      {
        q: "¿Cómo empiezo un proceso?",
        a: "Escríbenos por el formulario de contacto contándonos qué necesitas. Coordinamos una valoración inicial en la que un profesional entiende tu situación y define contigo el mejor camino a seguir.",
      },
      {
        q: "¿Las sesiones son en línea o presenciales?",
        a: "El acompañamiento se realiza de forma virtual a través de la plataforma. Algunas valoraciones específicas, como ciertas pruebas neuropsicológicas, pueden requerir aplicación presencial; te lo indicaremos si es tu caso.",
      },
      {
        q: "¿Qué diferencia a Mente en Foco de otras plataformas?",
        a: "Trabajamos con estándar clínico real: valoración estructurada, historia clínica, informes profesionales y clasificación diagnóstica CIE-11. No es solo apoyo emocional, es un proceso documentado y con seguimiento de tu evolución.",
      },
    ],
  },
  {
    title: "Planes y pagos",
    items: [
      {
        q: "¿Qué planes existen?",
        a: (
          <>
            Tenemos una cuenta gratuita y tres planes de acompañamiento: Primeros Pasos, Mi
            Equilibrio y Mi Mundo en Foco. Puedes ver todo el detalle y comparar beneficios en la{" "}
            <Link to="/asesoramiento" className="font-semibold text-primary hover:underline">
              página de planes
            </Link>
            .
          </>
        ),
      },
      {
        q: "¿La cuenta gratuita da acceso a terapia?",
        a: "La cuenta gratuita te permite conocer la plataforma y acceder a una selección de guías de bienestar. El acompañamiento con un especialista está incluido en los planes de pago.",
      },
      {
        q: "¿Puedo cambiar de plan más adelante?",
        a: "Sí. Puedes ampliar tu acompañamiento cuando quieras desde tu portal, y sumar más sesiones y contenido.",
      },
    ],
  },
  {
    title: "Privacidad y datos",
    items: [
      {
        q: "¿Mi información está protegida?",
        a: "Sí. Tratamos tus datos conforme a la normativa vigente de protección de datos personales, con cifrado en tránsito y controles de acceso. Puedes consultar el detalle en nuestra política de tratamiento de datos al crear tu cuenta.",
      },
      {
        q: "¿Quién puede ver mi historia clínica?",
        a: "Tu información clínica es confidencial y solo es accesible para el profesional que te acompaña. La historia clínica firmada es inmutable, conforme a la normativa aplicable.",
      },
    ],
  },
  {
    title: "Urgencias",
    items: [
      {
        q: "¿Qué hago en una emergencia de salud mental?",
        a: (
          <>
            Mente en Foco no es un servicio de urgencias. Si tú o alguien más está en riesgo
            inmediato, llama al <strong>123</strong> o consulta nuestras{" "}
            <Link to="/lineas-de-crisis" className="font-semibold text-primary hover:underline">
              líneas de crisis
            </Link>
            .
          </>
        ),
      },
    ],
  },
];

function AccordionItem({ item }: { item: QA }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-white/50 bg-white/50 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="text-sm font-semibold text-foreground">{item.q}</span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-primary transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm leading-relaxed text-muted-foreground">{item.a}</div>
      )}
    </div>
  );
}

function Faq() {
  return (
    <div className="reveal-scope">
      <RevealObserver />
      <section className="bg-[url('/BANNER.jpg')] bg-cover bg-center bg-no-repeat py-16 md:py-20">
        <div className="mx-auto max-w-4xl px-4 text-center glass-card mx-4 rounded-3xl py-14 shadow-lg border border-white/40">
          <h1 className="text-4xl font-bold text-primary md:text-5xl drop-shadow-sm">
            Preguntas frecuentes
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Resolvemos las dudas más comunes. Si no encuentras la tuya, escríbenos.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-14 md:px-6">
        <div className="space-y-10">
          {CATEGORIES.map((cat) => (
            <div key={cat.title}>
              <h2 className="mb-4 text-xl font-bold text-primary">{cat.title}</h2>
              <div className="space-y-3">
                {cat.items.map((item) => (
                  <AccordionItem key={item.q} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-3xl bg-primary/5 border border-primary/10 p-8 text-center">
          <h2 className="text-xl font-bold text-primary">¿Tienes otra pregunta?</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Nuestro equipo está para ayudarte. Escríbenos y te respondemos.
          </p>
          <Link
            to="/contactanos"
            className="mt-5 inline-flex rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:scale-105"
          >
            Contáctanos
          </Link>
        </div>
      </section>
    </div>
  );
}
