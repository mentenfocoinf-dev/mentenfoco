import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/asesoramiento")({
  head: () => ({
    meta: [
      { title: "Asesoramiento — Mente Sana" },
      { name: "description", content: "Tres planes de asesoramiento psicológico diseñados a tu medida." },
      { property: "og:title", content: "Asesoramiento — Mente Sana" },
      { property: "og:description", content: "Tres planes de asesoramiento psicológico diseñados a tu medida." },
    ],
  }),
  component: Asesoramiento,
});

const plans = [
  {
    name: "Esencial",
    price: "€49",
    period: "/sesión",
    desc: "Ideal para comenzar tu proceso de autoconocimiento.",
    features: [
      "1 sesión individual al mes",
      "Evaluación inicial completa",
      "Material de apoyo digital",
      "Atención por chat (horario laboral)",
    ],
    highlighted: false,
  },
  {
    name: "Integral",
    price: "€129",
    period: "/mes",
    desc: "El equilibrio perfecto entre acompañamiento y autonomía.",
    features: [
      "4 sesiones individuales al mes",
      "Plan terapéutico personalizado",
      "Acceso a guías premium",
      "Seguimiento semanal por chat",
      "Sesión grupal mensual",
    ],
    highlighted: true,
  },
  {
    name: "Premium",
    price: "€249",
    period: "/mes",
    desc: "Acompañamiento intensivo con un equipo multidisciplinar.",
    features: [
      "8 sesiones individuales al mes",
      "Equipo psicólogo + psiquiatra",
      "Disponibilidad 24/7 vía app",
      "Sesiones familiares incluidas",
      "Plan personalizado mensual",
      "Acceso total a recursos",
    ],
    highlighted: false,
  },
];

function Asesoramiento() {
  return (
    <>
      <section className="gradient-soft">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center md:px-6 md:py-20">
          <h1 className="text-4xl font-bold text-primary md:text-5xl">Planes de asesoramiento</h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Elige el plan que mejor se adapta a tus necesidades. Todos incluyen profesionales
            certificados y total confidencialidad.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-8 transition-shadow hover:shadow-lg ${
                plan.highlighted
                  ? "border-primary bg-primary text-primary-foreground shadow-md"
                  : "border-border bg-card"
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-background px-3 py-1 text-xs font-semibold text-primary">
                  Más popular
                </span>
              )}
              <h3 className={`text-2xl font-bold ${plan.highlighted ? "" : "text-primary"}`}>
                {plan.name}
              </h3>
              <p className={`mt-2 text-sm ${plan.highlighted ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                {plan.desc}
              </p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className={plan.highlighted ? "text-primary-foreground/70" : "text-muted-foreground"}>
                  {plan.period}
                </span>
              </div>
              <ul className="mt-6 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <span className={plan.highlighted ? "text-primary-foreground" : "text-primary"}>✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/contactanos"
                className={`mt-8 inline-flex w-full items-center justify-center rounded-md px-4 py-3 text-sm font-medium transition-colors ${
                  plan.highlighted
                    ? "bg-background text-primary hover:bg-background/90"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
              >
                Elegir {plan.name}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 md:px-6">
        <div className="rounded-2xl border border-border bg-card p-8 md:p-12">
          <h2 className="text-2xl font-semibold text-primary">¿Tienes dudas sobre qué plan elegir?</h2>
          <p className="mt-2 text-muted-foreground">
            Agenda una llamada gratuita de 15 minutos y te ayudamos a encontrar la opción ideal.
          </p>
          <Link
            to="/contactanos"
            className="mt-6 inline-flex rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Solicitar orientación
          </Link>
        </div>
      </section>
    </>
  );
}
