import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/guia")({
  head: () => ({
    meta: [
      { title: "Guías — Mente Sana" },
      { name: "description", content: "Guías prácticas para ansiedad, autoestima, motricidad y bienestar emocional." },
      { property: "og:title", content: "Guías — Mente Sana" },
      { property: "og:description", content: "Guías prácticas para afrontar diferentes situaciones de la vida." },
    ],
  }),
  component: Guia,
});

const categories = [
  { name: "Todas", count: 12 },
  { name: "Ansiedad", count: 3 },
  { name: "Autoestima", count: 3 },
  { name: "Infantil", count: 3 },
  { name: "Relaciones", count: 3 },
];

const guides = [
  { cat: "Ansiedad", title: "Cómo afrontar ataques de ansiedad", desc: "Técnicas de respiración y grounding paso a paso.", read: "8 min", icon: "🌬️" },
  { cat: "Ansiedad", title: "Manejo del estrés laboral", desc: "Estrategias efectivas para entornos exigentes.", read: "10 min", icon: "💼" },
  { cat: "Ansiedad", title: "Insomnio y descanso reparador", desc: "Higiene del sueño y mindfulness nocturno.", read: "7 min", icon: "🌙" },
  { cat: "Autoestima", title: "Mejorar tu autoconcepto", desc: "Ejercicios para reconectar con tu valor personal.", read: "12 min", icon: "💛" },
  { cat: "Autoestima", title: "Diálogo interno positivo", desc: "Reformula tus pensamientos automáticos.", read: "9 min", icon: "💭" },
  { cat: "Autoestima", title: "Establecer límites sanos", desc: "Aprende a decir 'no' sin culpa.", read: "6 min", icon: "🛡️" },
  { cat: "Infantil", title: "Estimular la motricidad", desc: "Actividades para desarrollar habilidades motoras.", read: "11 min", icon: "🧸" },
  { cat: "Infantil", title: "Manejo de berrinches", desc: "Comprender y acompañar la frustración infantil.", read: "8 min", icon: "👶" },
  { cat: "Infantil", title: "Apoyo escolar emocional", desc: "Acompañar el rendimiento sin presionar.", read: "10 min", icon: "📚" },
  { cat: "Relaciones", title: "Comunicación en pareja", desc: "Escucha activa y resolución de conflictos.", read: "13 min", icon: "💬" },
  { cat: "Relaciones", title: "Superar una ruptura", desc: "Proceso emocional y reconstrucción personal.", read: "15 min", icon: "🌱" },
  { cat: "Relaciones", title: "Apego y vínculos sanos", desc: "Identifica tu estilo de apego.", read: "12 min", icon: "🤝" },
];

function Guia() {
  return (
    <>
      <section className="gradient-soft">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center md:px-6 md:py-20">
          <h1 className="text-4xl font-bold text-primary md:text-5xl">Guías de bienestar</h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Recursos prácticos creados por nuestros profesionales para acompañarte en distintos
            momentos de tu vida.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="mb-8 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c.name}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:bg-primary-soft hover:text-primary"
            >
              {c.name} <span className="text-muted-foreground">({c.count})</span>
            </button>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {guides.map((g) => (
            <article
              key={g.title}
              className="group rounded-xl border border-border bg-card p-6 transition-all hover:border-primary hover:shadow-md"
            >
              <div className="text-3xl">{g.icon}</div>
              <span className="mt-4 inline-block rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
                {g.cat}
              </span>
              <h3 className="mt-3 text-lg font-semibold text-primary group-hover:underline">
                {g.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">{g.desc}</p>
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <span>📖 {g.read} de lectura</span>
                <span className="font-medium text-primary">Leer →</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
