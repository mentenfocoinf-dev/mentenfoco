import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/asesoramiento")({
  head: () => ({
    meta: [
      { title: "Asesoramiento — Mente en Foco" },
      { name: "description", content: "Tres planes de asesoramiento psicológico diseñados a tu medida." },
      { property: "og:title", content: "Asesoramiento — Mente en Foco" },
      { property: "og:description", content: "Tres planes de asesoramiento psicológico diseñados a tu medida." },
    ],
  }),
  component: Asesoramiento,
});

const plans = [
  {
    name: "Esencial",
    price: "$180.000",
    period: "/sesión",
    desc: "El paso inicial para cuidar de ti con la guía de un especialista.",
    features: [
      "1 sesión con tu especialista al mes",
      "Valoración inicial completa y cercana",
      "Material de apoyo práctico para tu día a día",
      "Seguimiento continuo por nuestra plataforma",
    ],
    highlighted: false,
    link: "https://buy.stripe.com/test_dRm6oH3zU0eMg7g64D5Vu03",
  },
  {
    name: "Integral",
    price: "$480.000",
    period: "/mes",
    desc: "Acompañamiento completo con varios especialistas trabajando para ti.",
    features: [
      "4 sesiones terapéuticas al mes",
      "Un plan de bienestar claro y a tu medida",
      "Nuestro equipo completo analiza tu avance",
      "Acompañamiento y apoyo semanal",
      "Acceso total a nuestras guías y herramientas",
    ],
    highlighted: true,
    link: "https://buy.stripe.com/test_28EbJ16M63qYaMWakT5Vu04",
  },
  {
    name: "Premium",
    price: "$950.000",
    period: "/mes",
    desc: "Cuidado integral y constante con todo nuestro equipo experto a tu lado.",
    features: [
      "8 sesiones terapéuticas al mes",
      "Atención médica y psicológica unida para ti",
      "Todo el equipo evalúa tu progreso mensualmente",
      "Sesiones de apoyo para tu familia",
      "Acompañamiento médico cuidadoso (si lo necesitas)",
      "Prioridad siempre que necesites agendar",
    ],
    highlighted: false,
    link: "https://buy.stripe.com/test_5kQ6oHfiCd1y7AKboX5Vu05",
  },
];

function Asesoramiento() {
  const [selectedPlan, setSelectedPlan] = useState<string | null>("Integral");
  
  return (
    <>
      <section className="bg-[url('/BANNER.jpg')] bg-cover bg-center bg-no-repeat">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center md:px-6 md:py-20 glass-card mx-4 rounded-3xl mt-8">
          <h1 className="text-4xl font-bold text-primary md:text-5xl drop-shadow-sm">Planes de Intervención Clínica</h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Planes diseñados para tu bienestar. Nuestro equipo de especialistas trabaja unido, usando métodos comprobados científicamente para apoyarte a ti y a tu familia.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
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
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <span className="text-primary font-bold">✓</span>
                    <span className="text-slate-700">{f}</span>
                  </li>
                ))}
              </ul>
              <a
                href={plan.link}
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
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 md:px-6">
        <div className="card-neon-hover rounded-3xl glass-card p-10 md:p-14 text-center">
          <h2 className="text-2xl font-semibold text-primary drop-shadow-sm">¿Tienes dudas sobre qué plan elegir?</h2>
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
