import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/membresia")({
  head: () => ({
    meta: [
      { title: "Membresía — Mente en Foco" },
      { name: "description", content: "Suscríbete y recibe beneficios exclusivos cada mes sin costo adicional." },
      { property: "og:title", content: "Membresía — Mente en Foco" },
      { property: "og:description", content: "Suscríbete y recibe beneficios exclusivos cada mes sin costo adicional." },
    ],
  }),
  component: Membresia,
});

const benefits = [
  { title: "Alex - IA 24/7", desc: "Agente inteligente especializado en salud mental disponible a toda hora." },
  { title: "Guías premium", desc: "Acceso ilimitado a más de 50 guías exclusivas cada mes." },
  { title: "Webinars en vivo", desc: "2 webinars mensuales con nuestros especialistas." },
  { title: "Meditaciones guiadas", desc: "Biblioteca de audios para ansiedad, sueño y relajación." },
  { title: "Test psicológicos", desc: "Evaluaciones validadas con resultados detallados." },
  { title: "Comunidad privada", desc: "Espacio seguro moderado por psicólogos." },
  { title: "Descuentos exclusivos", desc: "20% en sesiones individuales y talleres." },
];

const tiers = [
  { name: "Mensual", price: "$70.000", period: "/mes", note: "Cancela cuando quieras", link: "https://buy.stripe.com/test_3cI28r3zU0eM3kugJh5Vu01" },
  { name: "Anual", price: "$700.000", period: "/año", note: "Ahorra 2 meses", highlight: true, link: "https://buy.stripe.com/test_cNi7sLc6q3qY4oy8cL5Vu06" },
];

function Membresia() {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = direction === "left" ? -320 : 320;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  return (
    <>
      <section className="bg-[url('/BANNER.jpg')] bg-cover bg-center bg-no-repeat py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4 text-center glass-card mx-4 rounded-3xl py-16 shadow-lg border border-white/40">
          <span className="inline-block rounded-full bg-primary/20 backdrop-blur-sm border border-primary/30 px-4 py-1.5 text-xs font-medium text-primary shadow-sm">
            Membresía Mente en Foco+
          </span>
          <h1 className="mt-6 text-4xl font-bold text-primary md:text-5xl drop-shadow-sm">
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

        <div className="relative w-full flex items-center">
          <button
            onClick={() => scroll("left")}
            className="absolute -left-4 z-20 bg-white p-3 rounded-full shadow-lg border border-slate-100 hover:bg-slate-50 transition-all hidden md:block"
          >
            <ChevronLeft className="w-6 h-6 text-slate-700" />
          </button>

          {/* py-10 evita que la sombra neón se corte arriba y abajo */}
          <div
            ref={scrollRef}
            className="flex flex-row overflow-x-auto w-full gap-6 py-10 px-4 snap-x snap-mandatory hide-scrollbar scroll-smooth"
          >
            {benefits.map((item, index) => (
              <article
                key={index}
                className="relative w-[280px] h-[420px] flex-shrink-0 snap-start rounded-2xl overflow-hidden shadow-sm card-neon-hover bg-slate-100"
              >
                {/* Capa 1: Imagen de Fondo */}
                <div
                  className="absolute inset-0 bg-cover bg-top bg-no-repeat"
                  style={{
                    backgroundImage: `url('/membresia/${encodeURIComponent(item.title.replace("/", ""))}.png')`,
                  }}
                />

                {/* Capa 2: Degradado Blanco Inferior */}
                <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-white via-white/95 to-transparent z-0" />

                {/* Capa 3: Contenido */}
                <div className="absolute bottom-0 left-0 w-full p-6 z-10 flex flex-col justify-end">
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{item.desc}</p>
                </div>
              </article>
            ))}
          </div>

          <button
            onClick={() => scroll("right")}
            className="absolute -right-4 z-20 bg-white p-3 rounded-full shadow-lg border border-slate-100 hover:bg-slate-50 transition-all hidden md:block"
          >
            <ChevronRight className="w-6 h-6 text-slate-700" />
          </button>
        </div>
      </section>

      <section className="bg-primary/5 py-16">
        <div className="mx-auto max-w-4xl px-4 md:px-6 glass-card rounded-3xl py-16 border border-white/40 shadow-xl shadow-primary/5">
          <h2 className="text-center text-3xl font-bold text-primary drop-shadow-sm">Elige tu plan</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {tiers.map((t) => (
              <div
                key={t.name}
                className={`card-neon-hover rounded-3xl p-8 transition-transform hover:scale-[1.02] ${
                  t.highlight ? "bg-primary/20 backdrop-blur-xl shadow-lg shadow-primary/20" : "bg-white/40 backdrop-blur-lg"
                }`}
              >
                <h3 className="text-xl font-semibold text-primary">{t.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{t.price}</span>
                  <span className={t.highlight ? "text-primary/70" : "text-muted-foreground"}>{t.period}</span>
                </div>
                <p className={`mt-2 text-sm ${t.highlight ? "text-primary/80" : "text-muted-foreground"}`}>
                  {t.note}
                </p>
                <a
                  href={t.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`mt-6 inline-flex w-full items-center justify-center rounded-xl px-4 py-4 text-sm font-semibold transition-all hover:scale-105 shadow-sm ${
                    t.highlight
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20"
                      : "border border-primary/20 bg-background/50 backdrop-blur text-primary hover:bg-primary/10"
                  }`}
                >
                  Suscribirme
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
