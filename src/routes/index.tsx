import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mente Sana — Cuidamos tu bienestar emocional" },
      { name: "description", content: "Asesoramiento psicológico, guías de autoayuda y acompañamiento profesional para ti y tu familia." },
    ],
  }),
  component: Index,
});

const features = [
  { title: "Asesoramiento profesional", desc: "Planes diseñados para acompañarte en cada etapa.", icon: "🧭" },
  { title: "Guías especializadas", desc: "Recursos para ansiedad, autoestima, motricidad y más.", icon: "📚" },
  { title: "Membresía exclusiva", desc: "Beneficios mensuales sin costo adicional.", icon: "✨" },
  { title: "Portal para padres", desc: "Resultados y recomendaciones de tratamientos infantiles.", icon: "👨‍👩‍👧" },
];

const stats = [
  { value: "+5,000", label: "Pacientes acompañados" },
  { value: "12", label: "Años de experiencia" },
  { value: "30+", label: "Profesionales" },
  { value: "98%", label: "Satisfacción" },
];

function Index() {
  return (
    <>
      <section className="gradient-soft">
        <div className="mx-auto max-w-7xl px-4 py-20 md:px-6 md:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-block rounded-full bg-primary-soft px-4 py-1.5 text-xs font-medium text-primary">
              Salud mental con propósito
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-primary md:text-6xl">
              Tu bienestar emocional es nuestra prioridad
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              Acompañamiento profesional, guías prácticas y un equipo humano dedicado a apoyarte
              a ti y a tu familia en cada paso del camino.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/asesoramiento"
                className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Ver planes de asesoramiento
              </Link>
              <Link
                to="/guia"
                className="inline-flex items-center justify-center rounded-md border border-border bg-background px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                Explorar guías
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-md">
              <div className="text-3xl">{f.icon}</div>
              <h3 className="mt-4 text-lg font-semibold text-primary">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:grid-cols-2 md:grid-cols-4 md:px-6">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-4xl font-bold">{s.value}</div>
              <div className="mt-2 text-sm text-primary-foreground/70">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 md:px-6">
        <div className="rounded-2xl bg-primary-soft p-10 text-center md:p-16">
          <h2 className="text-3xl font-bold text-primary md:text-4xl">
            Da el primer paso hacia tu bienestar
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Agenda una consulta inicial gratuita y descubre cómo podemos ayudarte.
          </p>
          <Link
            to="/contactanos"
            className="mt-8 inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Contáctanos
          </Link>
        </div>
      </section>
    </>
  );
}
