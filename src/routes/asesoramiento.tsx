import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { PLAN_OFFERS, DEFAULT_HIGHLIGHTED_OFFER, buildCheckoutLink } from "../lib/api";

export const Route = createFileRoute("/asesoramiento")({
  head: () => ({
    meta: [
      { title: "Asesoramiento — Mente en Foco" },
      {
        name: "description",
        content: "Tres planes de asesoramiento psicológico diseñados a tu medida.",
      },
      { property: "og:title", content: "Asesoramiento — Mente en Foco" },
      {
        property: "og:description",
        content: "Tres planes de asesoramiento psicológico diseñados a tu medida.",
      },
    ],
  }),
  component: Asesoramiento,
});

// Detalle de sesiones y acompañamiento de cada plan (la parte comercial:
// precio, enlace y descripción vive en src/lib/api/plans.ts)
const PLAN_FEATURES: Record<string, string[]> = {
  esencial: [
    "1 sesión con tu especialista al mes",
    "Valoración inicial completa y cercana",
    "Material de apoyo práctico para tu día a día",
    "Seguimiento continuo por nuestra plataforma",
    "Acceso a las guías clínicas premium",
  ],
  integral: [
    "4 sesiones terapéuticas al mes",
    "Un plan de bienestar claro y a tu medida",
    "Nuestro equipo completo analiza tu avance",
    "Acompañamiento y apoyo semanal",
    "Acceso total a nuestras guías y herramientas",
    "Webinars en vivo y meditaciones guiadas",
  ],
  premium: [
    "8 sesiones terapéuticas al mes",
    "Atención médica y psicológica unida para ti",
    "Todo el equipo evalúa tu progreso mensualmente",
    "Sesiones de apoyo para tu familia",
    "Acompañamiento médico cuidadoso (si lo necesitas)",
    "Prioridad siempre que necesites agendar",
    "Acceso completo a todo el contenido de la plataforma",
  ],
};

function Asesoramiento() {
  // Deriva el nombre del plan destacado en vez de repetirlo aquí: un nombre
  // hardcodeado ("Integral") dejó de coincidir con plan.name la última vez que
  // se renombraron los planes, y ninguna tarjeta quedaba preseleccionada.
  const [selectedPlan, setSelectedPlan] = useState<string | null>(
    DEFAULT_HIGHLIGHTED_OFFER.name,
  );
  const { profile } = useAuth();

  return (
    <>
      <section className="bg-[url('/BANNER.jpg')] bg-cover bg-center bg-no-repeat">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center md:px-6 md:py-20 glass-card mx-4 rounded-3xl mt-8">
          <h1 className="text-4xl font-bold text-primary md:text-5xl drop-shadow-sm">
            Planes de Intervención Clínica
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Planes diseñados para tu bienestar. Nuestro equipo de especialistas trabaja unido,
            usando métodos comprobados científicamente para apoyarte a ti y a tu familia.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {PLAN_OFFERS.map((plan) => (
            <div
              key={plan.name}
              onClick={() => setSelectedPlan(plan.name)}
              className={`card-neon-hover relative bg-white rounded-3xl p-8 shadow-sm transition-all duration-300 cursor-pointer hover:shadow-xl hover:scale-105 flex flex-col ${
                selectedPlan === plan.name ? "selected-card-glow scale-105" : ""
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-primary/20 bg-background/80 backdrop-blur-sm px-3 py-1 text-xs font-semibold text-primary shadow-sm">
                  Más popular
                </span>
              )}
              <h3 className="text-2xl font-bold text-primary">{plan.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{plan.desc}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-slate-900">{plan.price}</span>
                <span className="text-muted-foreground">{plan.period}</span>
              </div>
              <ul className="mt-6 space-y-3 flex-grow">
                {(PLAN_FEATURES[plan.plan] ?? []).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <span className="text-primary font-bold">✓</span>
                    <span className="text-slate-700">{f}</span>
                  </li>
                ))}
              </ul>
              <a
                href={buildCheckoutLink(plan.link, profile)}
                target="_blank"
                rel="noopener noreferrer"
                className={`mt-8 inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition-all hover:scale-105 shadow-sm ${
                  plan.highlighted
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20"
                    : "border border-primary/20 text-primary hover:bg-primary/10"
                }`}
              >
                Elegir {plan.name}
              </a>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Cada plan incluye el nivel de contenido digital correspondiente.{" "}
          <Link to="/membresia" className="font-bold text-primary hover:underline">
            Compara todos los beneficios aquí
          </Link>
          .
        </p>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 md:px-6">
        <div className="card-neon-hover rounded-3xl glass-card p-10 md:p-14 text-center">
          <h2 className="text-2xl font-semibold text-primary drop-shadow-sm">
            ¿Tienes dudas sobre qué plan elegir?
          </h2>
          <p className="mt-2 text-muted-foreground">
            Agenda una llamada gratuita de 15 minutos y te ayudamos a encontrar la opción ideal.
          </p>
          <Link
            to="/contactanos"
            className="mt-6 inline-flex rounded-xl bg-primary px-8 py-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-transform hover:scale-105 shadow-lg shadow-primary/20"
          >
            Solicitar orientación
          </Link>
        </div>
      </section>
    </>
  );
}
