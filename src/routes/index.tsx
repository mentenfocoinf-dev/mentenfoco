import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mente en Foco — Cuidamos tu bienestar emocional" },
      { name: "description", content: "Asesoramiento psicológico, guías de autoayuda y acompañamiento profesional para ti y tu familia." },
    ],
  }),
  component: Index,
});

const features = [
  { title: "Asesoramiento profesional", desc: "Planes diseñados para acompañarte en cada etapa.", to: "/asesoramiento", image: "/images/asesoramiento.jpg" },
  { title: "Guías especializadas", desc: "Recursos para ansiedad, autoestima, motricidad y más.", to: "/guia", image: "/images/guias.jpg" },
  { title: "Membresía exclusiva", desc: "Beneficios mensuales sin costo adicional.", to: "/membresia", image: "/images/membresia.jpg" },
  { title: "Portal de ingreso", desc: "Acceso seguro a tus resultados, recomendaciones y panel personal.", to: "/ingresa", image: "/images/portal.jpg" },
];

const stats = [
  { value: "70%", label: "Eficacia Clínica Comprobada" },
  { value: "4", label: "Especialidades Integradas" },
  { value: "100%", label: "Basado en Evidencia Científica" },
  { value: "+5,000", label: "Pacientes Atendidos" },
];

const disciplines = [
  { title: "Psiquiatría", desc: "Atención médica especializada para estabilizar tu bienestar. Evaluamos y tratamos con rigor científico y profunda empatía cuando se requiere apoyo farmacológico." },
  { title: "Psicología Clínica", desc: "Terapia enfocada en darte herramientas prácticas. Te ayudamos a entender tus emociones y superar retos para alcanzar una vida más tranquila." },
  { title: "Neuropsicología", desc: "Evaluación y cuidado de tu cerebro. Ayudamos a niños, adultos y mayores a potenciar su memoria, atención y agilidad mental." },
  { title: "Fonoaudiología", desc: "Apoyo profesional en comunicación, lenguaje y aprendizaje. Trabajamos para superar dificultades al hablar o tragar, mejorando tu integración." }
];

function Index() {
  return (
    <>
      <section className="bg-[url('/BANNER.jpg')] bg-cover bg-center bg-no-repeat">
        <div className="mx-auto max-w-7xl px-4 py-20 md:px-6 md:py-28">
          <div className="mx-auto max-w-3xl text-center glass-card p-10 rounded-3xl">
            <span className="inline-block rounded-full bg-primary/20 backdrop-blur-sm border border-primary/30 px-4 py-1.5 text-xs font-medium text-primary shadow-sm">
              Primer Centro Clínico de Bienestar Integral
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-primary md:text-6xl drop-shadow-sm">
              Ciencia, neurodesarrollo y empatía a tu servicio
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              Unimos la ciencia y el calor humano para cuidar tu salud mental. Nuestro equipo de especialistas te acompaña a ti y a tu familia en cada etapa, brindándote herramientas reales para vivir mejor.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/asesoramiento"
                className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Conoce nuestra intervención
              </Link>
              <Link
                to="/guia"
                className="inline-flex items-center justify-center rounded-md border border-border bg-background px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                Explorar recursos clínicos
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            // @ts-ignore - Ignore type error if the route hasn't been generated yet
            <Link key={f.title} to={f.to} className="group card-neon-hover flex flex-col rounded-2xl glass-card overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
              <div className="h-48 w-full overflow-hidden bg-muted">
                <img src={f.image} alt={f.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <h3 className="text-lg font-semibold text-primary">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-primary md:text-4xl drop-shadow-sm">Nuestras Disciplinas Clínicas</h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Un espacio donde diferentes especialistas de la salud mental se unen para darte un diagnóstico certero y un tratamiento verdaderamente integral.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {disciplines.map((d) => (
            <div key={d.title} className="card-neon-hover rounded-2xl glass-card p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
              <div className="h-2 w-12 bg-primary rounded-full mb-5"></div>
              <h3 className="text-xl font-bold text-primary">{d.title}</h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{d.desc}</p>
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
        <div className="card-neon-hover rounded-3xl glass-card p-10 text-center md:p-16 shadow-lg">
          <h2 className="text-3xl font-bold text-primary md:text-4xl drop-shadow-sm">
            Da el primer paso hacia tu bienestar
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Agenda una consulta inicial gratuita y descubre cómo podemos ayudarte.
          </p>
          <Link
            to="/contactanos"
            className="mt-8 inline-flex items-center justify-center rounded-xl bg-primary px-8 py-4 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:scale-105 shadow-xl shadow-primary/20"
          >
            Contáctanos
          </Link>
        </div>
      </section>
    </>
  );
}
