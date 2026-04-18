import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sobre-nosotros")({
  head: () => ({
    meta: [
      { title: "Sobre nosotros — Mente Sana" },
      { name: "description", content: "Conoce nuestro equipo, misión y valores en el cuidado de la salud mental." },
      { property: "og:title", content: "Sobre nosotros — Mente Sana" },
      { property: "og:description", content: "Conoce nuestro equipo, misión y valores en el cuidado de la salud mental." },
    ],
  }),
  component: SobreNosotros,
});

const values = [
  { title: "Empatía", desc: "Escuchamos sin juzgar. Cada historia merece comprensión.", icon: "💛" },
  { title: "Profesionalismo", desc: "Equipo certificado con formación continua.", icon: "🎓" },
  { title: "Confidencialidad", desc: "Tu privacidad es absoluta. Siempre.", icon: "🔒" },
  { title: "Cercanía", desc: "Trato humano, accesible y sin tecnicismos innecesarios.", icon: "🤝" },
];

const team = [
  { name: "Dra. María Torres", role: "Directora · Psic. Clínica", years: "15 años de experiencia" },
  { name: "Dr. Javier Ruiz", role: "Psiquiatra", years: "20 años de experiencia" },
  { name: "Lic. Ana Martín", role: "Psic. Infantil", years: "10 años de experiencia" },
  { name: "Lic. Carlos Vega", role: "Psic. de Pareja", years: "12 años de experiencia" },
];

function SobreNosotros() {
  return (
    <>
      <section className="gradient-soft">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center md:px-6">
          <h1 className="text-4xl font-bold text-primary md:text-5xl">Sobre nosotros</h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Somos un centro de salud mental fundado en 2013 con la misión de hacer accesible el
            bienestar emocional. Creemos que cuidar la mente es tan importante como cuidar el cuerpo.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="rounded-2xl bg-primary-soft p-8">
            <h2 className="text-2xl font-semibold text-primary">Nuestra misión</h2>
            <p className="mt-3 text-muted-foreground">
              Acompañar a personas y familias en su camino hacia el bienestar emocional, ofreciendo
              herramientas profesionales, cercanas y basadas en evidencia.
            </p>
          </div>
          <div className="rounded-2xl bg-primary-soft p-8">
            <h2 className="text-2xl font-semibold text-primary">Nuestra visión</h2>
            <p className="mt-3 text-muted-foreground">
              Ser un referente en salud mental que normalice hablar de emociones, derribe estigmas
              y ofrezca apoyo de calidad a cada etapa de la vida.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <h2 className="text-center text-3xl font-bold text-primary">Nuestros valores</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((v) => (
            <div key={v.title} className="rounded-xl border border-border bg-card p-6 text-center">
              <div className="text-3xl">{v.icon}</div>
              <h3 className="mt-4 text-lg font-semibold text-primary">{v.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-muted">
        <div className="mx-auto max-w-7xl px-4 py-16 md:px-6">
          <h2 className="text-center text-3xl font-bold text-primary">Nuestro equipo</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
            Profesionales colegiados con amplia experiencia en distintas áreas de la psicología.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {team.map((m) => (
              <div key={m.name} className="rounded-xl border border-border bg-card p-6 text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary text-2xl text-primary-foreground">
                  {m.name.split(" ")[1]?.[0]}
                </div>
                <h3 className="mt-4 font-semibold text-primary">{m.name}</h3>
                <p className="mt-1 text-sm text-foreground">{m.role}</p>
                <p className="mt-1 text-xs text-muted-foreground">{m.years}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
