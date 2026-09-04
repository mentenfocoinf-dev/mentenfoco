import { createFileRoute, Link } from "@tanstack/react-router";
import { RevealObserver } from "../components/home/RevealObserver";
import { HeroImagen } from "../components/HeroImagen";
import { useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, Check, Minus } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import {
  trackEvent,
  MEMBERSHIP_TIERS,
  PLAN_BENEFITS,
  benefitsForPlan,
  PLAN_LABELS,
  PLAN_RANK,
  buildCheckoutLink,
} from "../lib/api";
import type { PlanType } from "../lib/supabase";
import { FlipPlanCard } from "../components/plans/FlipPlanCard";

/** Cabecera de cada tarjeta de etapa. Ver public/planes/. */
const MEMBERSHIP_IMAGES: Record<string, string> = {
  integral: "/planes/mi-equilibrio.jpg",
  premium: "/planes/mi-mundo-en-foco.jpg",
};

export const Route = createFileRoute("/membresia")({
  head: () => ({
    meta: [
      { title: "Planes de acompañamiento — Mente en Foco" },
      {
        name: "description",
        content: "Cada etapa de acompañamiento suma recursos, herramientas y contenido para tu proceso.",
      },
      { property: "og:title", content: "Planes de acompañamiento — Mente en Foco" },
      {
        property: "og:description",
        content: "Cada etapa de acompañamiento suma recursos, herramientas y contenido para tu proceso.",
      },
    ],
  }),
  component: Membresia,
});

const benefits = [
  {
    title: "Alex IA (Próximamente)",
    desc: "Agente inteligente especializado en salud mental — en desarrollo, disponible próximamente.",
  },
  { title: "Guías clínicas", desc: "Acceso a la biblioteca completa de guías de nuestro equipo." },
  { title: "Webinars en vivo", desc: "2 webinars mensuales con nuestros especialistas." },
  {
    title: "Meditaciones guiadas",
    desc: "Biblioteca de audios para ansiedad, sueño y relajación.",
  },
  { title: "Test psicológicos", desc: "Evaluaciones validadas con resultados detallados." },
  { title: "Comunidad privada", desc: "Espacio seguro moderado por psicólogos." },
  { title: "Sesiones y talleres", desc: "Condiciones preferentes en sesiones individuales y talleres." },
];

// Columnas de la tabla comparativa de niveles de acceso. Los labels se leen de
// PLAN_LABELS (no se repiten aquí) para que esta tabla y las tarjetas de plan
// de /asesoramiento usen siempre el mismo nombre — quedaban desalineadas si se
// hardcodeaban por separado y solo se renombraba una de las dos.
const COMPARE_PLANS: { plan: PlanType; label: string }[] = [
  { plan: "free", label: PLAN_LABELS.free },
  { plan: "esencial", label: PLAN_LABELS.esencial },
  { plan: "integral", label: PLAN_LABELS.integral },
  { plan: "premium", label: PLAN_LABELS.premium },
];

function Membresia() {
  useEffect(() => {
    trackEvent("PLAN_VIEWED", { resource_type: "contenido" });
  }, []);

  const scrollRef = useRef<HTMLDivElement>(null);
  const { profile } = useAuth();

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = direction === "left" ? -320 : 320;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  return (
    <div className="reveal-scope">
      <RevealObserver />
      <HeroImagen image="/cabecera-planes.jpg">
        <div className="mx-auto max-w-7xl px-4 text-center glass-card mx-4 rounded-3xl py-16 shadow-lg border border-white/40">
          <span className="inline-block rounded-full bg-primary/20 backdrop-blur-sm border border-primary/30 px-4 py-1.5 text-xs font-medium text-primary shadow-sm">
            Invierte en tu bienestar
          </span>
          <h1 className="mt-6 text-4xl font-bold text-primary md:text-5xl drop-shadow-sm">
            Más recursos, mismo compromiso
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Cada etapa suma contenido, herramientas y acompañamiento para el momento en el que
            estás.
          </p>
        </div>
      </HeroImagen>

      {/* ── Tabla comparativa: qué incluye cada nivel ──
          Va antes del carrusel a propósito: es la comparación que responde
          "¿cuál me conviene?" y antes obligaba a bajar mucho para verla. */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:px-6">
        <h2 className="mb-2 text-center text-3xl font-bold text-primary">
          Compara los niveles de acceso
        </h2>
        <p className="mb-8 text-center text-sm text-muted-foreground max-w-2xl mx-auto">
          Cada etapa incluye todo lo de la anterior. La opción mensual te acompaña en{" "}
          {PLAN_LABELS.integral} y la anual, en {PLAN_LABELS.premium} completo.
        </p>
        <div className="overflow-x-auto rounded-3xl border border-white/60 glass-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/60 bg-primary/5">
                <th className="px-5 py-4 text-left font-bold text-primary">Beneficio</th>
                {COMPARE_PLANS.map((c) => (
                  <th key={c.plan} className="px-4 py-4 text-center font-bold text-primary">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLAN_BENEFITS.map((b, i) => (
                <tr
                  key={b.label}
                  className={`border-b border-white/40 hover:bg-white/40 transition-colors ${
                    i === PLAN_BENEFITS.length - 1 ? "border-none" : ""
                  }`}
                >
                  <td className="px-5 py-3.5">
                    <p className="font-semibold text-slate-800">{b.label}</p>
                    <p className="text-xs text-muted-foreground">{b.detail}</p>
                  </td>
                  {COMPARE_PLANS.map((c) => (
                    <td key={c.plan} className="px-4 py-3.5 text-center">
                      {PLAN_RANK[b.minPlan] <= PLAN_RANK[c.plan] ? (
                        <Check size={18} className="mx-auto text-emerald-500" />
                      ) : (
                        <Minus size={16} className="mx-auto text-slate-300" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
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
          <h2 className="text-center text-3xl font-bold text-primary drop-shadow-sm">
            Elige cómo quieres avanzar
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-2">
            {MEMBERSHIP_TIERS.map((t) => (
              <FlipPlanCard
                key={t.name}
                name={t.name}
                price={t.price}
                period={t.period}
                desc={t.note}
                // El reverso muestra lo que ese nivel de contenido desbloquea:
                // es el detalle que la persona necesita antes de pagar.
                features={benefitsForPlan(t.plan).map((b) => b.label)}
                checkoutUrl={buildCheckoutLink(t.link, profile)}
                image={MEMBERSHIP_IMAGES[t.plan]}
                highlighted={t.highlight}
                footnote="El cobro se hace en la pasarela; puedes cancelar cuando quieras."
              />
            ))}
          </div>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            ¿Buscas sesiones con un especialista?{" "}
            <Link to="/asesoramiento" className="font-bold text-primary hover:underline">
              Conoce los planes de asesoramiento
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
