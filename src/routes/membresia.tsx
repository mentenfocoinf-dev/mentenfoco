import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/membresia")({
  head: () => ({
    meta: [
      { title: "Membresía — Mente Sana" },
      { name: "description", content: "Suscríbete y recibe beneficios exclusivos cada mes sin costo adicional." },
      { property: "og:title", content: "Membresía — Mente Sana" },
      { property: "og:description", content: "Suscríbete y recibe beneficios exclusivos cada mes sin costo adicional." },
    ],
  }),
  component: Membresia,
});

const benefits = [
  { icon: "📚", title: "Guías premium", desc: "Acceso ilimitado a más de 50 guías exclusivas cada mes." },
  { icon: "🎙️", title: "Webinars en vivo", desc: "2 webinars mensuales con nuestros especialistas." },
  { icon: "🧘", title: "Meditaciones guiadas", desc: "Biblioteca de audios para ansiedad, sueño y relajación." },
  { icon: "📊", title: "Test psicológicos", desc: "Evaluaciones validadas con resultados detallados." },
  { icon: "💬", title: "Comunidad privada", desc: "Espacio seguro moderado por psicólogos." },
  { icon: "🎁", title: "Descuentos exclusivos", desc: "20% en sesiones individuales y talleres." },
];

const tiers = [
  { name: "Mensual", price: "€19", period: "/mes", note: "Cancela cuando quieras" },
  { name: "Anual", price: "€179", period: "/año", note: "Ahorra 2 meses", highlight: true },
];

function Membresia() {
  return (
    <>
      <section className="gradient-soft">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center md:px-6 md:py-20">
          <span className="inline-block rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground">
            Membresía Mente Sana+
          </span>
          <h1 className="mt-6 text-4xl font-bold text-primary md:text-5xl">
            Más recursos, mismo compromiso
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Suscríbete y recibe cada mes contenido exclusivo, herramientas y beneficios que
            potencian tu bienestar emocional.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <h2 className="mb-10 text-center text-3xl font-bold text-primary">¿Qué incluye?</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {benefits.map((b) => (
            <div key={b.title} className="rounded-xl border border-border bg-card p-6">
              <div className="text-3xl">{b.icon}</div>
              <h3 className="mt-4 text-lg font-semibold text-primary">{b.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-primary-soft">
        <div className="mx-auto max-w-4xl px-4 py-16 md:px-6">
          <h2 className="text-center text-3xl font-bold text-primary">Elige tu plan</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {tiers.map((t) => (
              <div
                key={t.name}
                className={`rounded-2xl border p-8 ${
                  t.highlight ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
                }`}
              >
                <h3 className={`text-xl font-semibold ${t.highlight ? "" : "text-primary"}`}>{t.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{t.price}</span>
                  <span className={t.highlight ? "text-primary-foreground/70" : "text-muted-foreground"}>{t.period}</span>
                </div>
                <p className={`mt-2 text-sm ${t.highlight ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  {t.note}
                </p>
                <Link
                  to="/contactanos"
                  className={`mt-6 inline-flex w-full items-center justify-center rounded-md px-4 py-3 text-sm font-medium transition-colors ${
                    t.highlight ? "bg-background text-primary hover:bg-background/90" : "bg-primary text-primary-foreground hover:bg-primary/90"
                  }`}
                >
                  Suscribirme
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
