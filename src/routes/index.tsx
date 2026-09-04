import { createFileRoute, Link } from "@tanstack/react-router";
import { HeroImagen } from "../components/HeroImagen";
import { ContinuaDondeLoDejaste } from "../components/home/ContinuaDondeLoDejaste";
import { Reveal } from "../components/home/Reveal";
import { NotificacionesBadge } from "../components/NotificacionesBadge";
import {
  ShieldCheck,
  Sparkles,
  ClipboardList,
  FileText,
  Stethoscope,
  ArrowRight,
  ArrowDown,
} from "lucide-react";
import { listGuides } from "../lib/api";
import { Fragment, useEffect } from "react";
import { trackEvent } from "../lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mente en Foco — Cuidamos tu bienestar emocional" },
      {
        name: "description",
        content:
          "Asesoramiento psicológico, guías de autoayuda y acompañamiento profesional para ti y tu familia.",
      },
    ],
  }),
  loader: async () => {
    // Guías destacadas reales desde clinical_guides_meta (mismo servicio que /guia).
    const guias = await listGuides();
    return { guias: guias.slice(0, 6) };
  },
  component: Index,
});

const features = [
  {
    title: "Asesoramiento profesional",
    desc: "Planes diseñados para acompañarte en cada etapa.",
    to: "/asesoramiento",
    image: "/images/asesoramiento.jpg",
  },
  {
    title: "Guías especializadas",
    desc: "Recursos para ansiedad, autoestima, motricidad y más.",
    to: "/guia",
    image: "/images/guias.jpg",
  },
  {
    title: "Biblioteca de tu etapa",
    desc: "Beneficios mensuales sin costo adicional.",
    to: "/membresia",
    image: "/images/membresia.jpg",
  },
  {
    title: "Portal de ingreso",
    desc: "Acceso seguro a tus resultados, recomendaciones y panel personal.",
    to: "/ingresa",
    image: "/images/portal.jpg",
  },
];

// Solo datos verificables: nada de eficacias ni conteos de pacientes inventados
// (ADR-007). Las 4 disciplinas y el estándar CIE-11 son hechos comprobables.
const stats = [
  { value: "4", label: "Especialidades integradas" },
  { value: "CIE-11", label: "Estándar diagnóstico internacional" },
];

// Cada disciplina enlaza a su landing de servicio. `image` es una imagen
// alusiva de fondo (con transparencia para no perder el texto); si el archivo
// aún no existe en public/disciplinas/, la tarjeta degrada a fondo limpio.
const disciplines = [
  {
    title: "Psiquiatría",
    slug: "psiquiatria",
    image: "/disciplinas/psiquiatria.svg",
    tint: "from-sky-200 to-indigo-200",
    desc: "Atención médica especializada para estabilizar tu bienestar. Evaluamos y tratamos con rigor científico y profunda empatía cuando se requiere apoyo farmacológico.",
  },
  {
    title: "Psicología Clínica",
    slug: "psicologia-clinica",
    image: "/disciplinas/psicologia-clinica.svg",
    tint: "from-rose-200 to-orange-200",
    desc: "Terapia enfocada en darte herramientas prácticas. Te ayudamos a entender tus emociones y superar retos para alcanzar una vida más tranquila.",
  },
  {
    title: "Neuropsicología",
    slug: "neuropsicologia",
    image: "/disciplinas/neuropsicologia.svg",
    tint: "from-violet-200 to-fuchsia-200",
    desc: "Evaluación y cuidado de tu cerebro. Ayudamos a niños, adultos y mayores a potenciar su memoria, atención y agilidad mental.",
  },
  {
    title: "Fonoaudiología",
    slug: "fonoaudiologia",
    image: "/disciplinas/fonoaudiologia.svg",
    tint: "from-emerald-200 to-teal-200",
    desc: "Apoyo profesional en comunicación, lenguaje y aprendizaje. Trabajamos para superar dificultades al hablar o tragar, mejorando tu integración.",
  },
];

// Programas por situación de vida. Por ahora enlazan a las guías del tema, hasta
// que exista una página de Programas propia (fase posterior).
const programas = [
  { title: "Ansiedad", desc: "Herramientas para calmar la mente y recuperar el control." },
  { title: "Duelo", desc: "Acompañamiento para atravesar una pérdida a tu ritmo." },
  { title: "Ruptura", desc: "Reconstruirte después del final de una relación." },
  { title: "Estrés laboral", desc: "Recuperar el equilibrio cuando el trabajo agota." },
  { title: "Autoestima", desc: "Cultivar una relación más sana contigo mismo." },
  { title: "Sueño", desc: "Volver a descansar de verdad." },
];

const comoFunciona = [
  {
    title: "Cuéntanos cómo estás",
    desc: "Nos escribes o haces una valoración inicial para entender qué necesitas.",
  },
  {
    title: "Te acompaña un especialista",
    desc: "Definimos contigo un plan de trabajo con objetivos claros, no sesiones sueltas.",
  },
  {
    title: "Avanzas a tu ritmo",
    desc: "Seguimos tu evolución con instrumentos clínicos y ajustamos el camino contigo.",
  },
];

function Index() {
  // Journey Engine: registro de vista. No bloquea nada y su fallo es silencioso.
  useEffect(() => {
    trackEvent("HOME_VIEW");
  }, []);

  const { guias } = Route.useLoaderData();

  return (
    <>
      {/* ── Hero (existente) ── */}
      <HeroImagen image="/hero-inicio.jpg" tall>
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="mx-auto max-w-3xl text-center glass-card p-10 rounded-3xl">
            <span className="inline-block rounded-full bg-primary/20 backdrop-blur-sm border border-primary/30 px-4 py-1.5 text-xs font-medium text-primary shadow-sm">
              Primer Centro Clínico de Bienestar Integral
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-primary md:text-6xl drop-shadow-sm">
              Ciencia, neurodesarrollo y empatía a tu servicio
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              Unimos la ciencia y el calor humano para cuidar tu salud mental. Nuestro equipo de
              especialistas te acompaña a ti y a tu familia en cada etapa, brindándote herramientas
              reales para vivir mejor.
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
      </HeroImagen>

      {/* ── Continuidad ──
          Va justo debajo del hero: quien ya empezó algo debe encontrarlo antes
          que la presentación del centro. Si no hay nada que retomar, no se
          dibuja y la Home queda exactamente como estaba. */}
      <div className="mx-auto flex max-w-6xl justify-end px-4 pt-4 md:px-6">
        <NotificacionesBadge />
      </div>

      <ContinuaDondeLoDejaste />

      {/* ── 4 accesos rápidos (existente) ── */}
      <Reveal as="section" className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            // @ts-ignore - Ignore type error if the route hasn't been generated yet
            <Link
              key={f.title}
              to={f.to}
              className="group card-neon-hover flex flex-col rounded-2xl glass-card overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
            >
              <div className="h-48 w-full overflow-hidden bg-muted">
                <img
                  src={f.image}
                  alt={f.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <h3 className="text-lg font-semibold text-primary">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </Reveal>

      {/* ── Cómo funciona (NUEVO) ── */}
      <Reveal as="section" className="bg-primary/5 py-16">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-primary md:text-4xl drop-shadow-sm">
              Cómo funciona
            </h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              Empezar es sencillo. Tú pones el ritmo; nosotros, el método y el acompañamiento.
            </p>
          </div>
          {/* Los pasos van unidos por flechas —no numerados— para que se lean
              como una secuencia: en escritorio la flecha apunta al siguiente,
              en móvil (apilado) apunta hacia abajo. */}
          <div className="flex flex-col items-stretch gap-4 md:flex-row md:items-center md:justify-center">
            {comoFunciona.map((s, i) => (
              <Fragment key={s.title}>
                <div className="card-neon-hover flex-1 rounded-3xl glass-card p-8 border border-white/40 text-center">
                  <h3 className="text-lg font-bold text-primary">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
                </div>
                {i < comoFunciona.length - 1 && (
                  <>
                    <ArrowRight
                      aria-hidden="true"
                      size={28}
                      className="hidden shrink-0 text-primary/50 md:block"
                    />
                    <ArrowDown
                      aria-hidden="true"
                      size={24}
                      className="mx-auto shrink-0 text-primary/50 md:hidden"
                    />
                  </>
                )}
              </Fragment>
            ))}
          </div>
        </div>
      </Reveal>

      {/* ── Disciplinas (existente, ahora enlazadas) ── */}
      <Reveal as="section" className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-primary md:text-4xl drop-shadow-sm">
            Nuestras Disciplinas Clínicas
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Un espacio donde diferentes especialistas de la salud mental se unen para darte un
            diagnóstico certero y un tratamiento verdaderamente integral.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {disciplines.map((d) => (
            <Link
              key={d.title}
              to="/servicios/$slug"
              params={{ slug: d.slug }}
              className="card-neon-hover group relative overflow-hidden rounded-2xl glass-card p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col"
            >
              {/* Base: un degradado alusivo por disciplina, siempre presente
                  (para que la tarjeta nunca se vea vacía). */}
              <div
                aria-hidden="true"
                className={`absolute inset-0 z-0 bg-gradient-to-br ${d.tint} opacity-40`}
              />
              {/* Imagen real (opcional) encima del degradado, con transparencia.
                  Si el archivo no existe, no se ve nada roto. */}
              <div
                aria-hidden="true"
                className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-25 transition-opacity duration-300 group-hover:opacity-35"
                style={{ backgroundImage: `url('${d.image}')` }}
              />
              {/* Velo para asegurar contraste del texto sobre la imagen. */}
              <div
                aria-hidden="true"
                className="absolute inset-0 z-0 bg-gradient-to-t from-white/85 via-white/60 to-white/40"
              />
              <div className="relative z-10 flex flex-1 flex-col">
                <h3 className="text-xl font-bold text-primary">{d.title}</h3>
                <p className="mt-3 flex-1 text-sm text-muted-foreground leading-relaxed">{d.desc}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-primary">
                  Conocer más{" "}
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Reveal>

      {/* ── Programas por situación (NUEVO) ── */}
      <Reveal as="section" className="bg-primary/5 py-16">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-primary md:text-4xl drop-shadow-sm">
              Por lo que estás viviendo
            </h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              No importa cómo se llame lo que sientes. Encuentra recursos y acompañamiento para tu
              momento.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {programas.map((p) => (
              <Link
                key={p.title}
                to="/guia"
                className="card-neon-hover group rounded-2xl glass-card p-6 border border-white/40 transition-all hover:-translate-y-1 flex items-center justify-between gap-3"
              >
                <div>
                  <h3 className="text-lg font-bold text-primary">{p.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{p.desc}</p>
                </div>
                <ArrowRight
                  size={18}
                  className="shrink-0 text-primary group-hover:translate-x-1 transition-transform"
                />
              </Link>
            ))}
          </div>
        </div>
      </Reveal>

      {/* ── Diferenciador clínico (NUEVO — el foso defensivo) ── */}
      <Reveal as="section" className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <div className="rounded-3xl bg-primary text-primary-foreground p-10 md:p-14 shadow-xl">
          <div className="max-w-3xl">
            <span className="inline-block rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold">
              Lo que nos hace diferentes
            </span>
            <h2 className="mt-5 text-3xl font-bold md:text-4xl">
              No es solo apoyo emocional. Es un proceso clínico de verdad.
            </h2>
            <p className="mt-4 text-primary-foreground/80 leading-relaxed">
              La mayoría de las plataformas ofrecen charlas de apoyo. Nosotros trabajamos con el
              estándar de un centro clínico: valoración estructurada, historia clínica, informes
              profesionales y clasificación diagnóstica internacional (CIE-11). Tu proceso queda
              documentado, con seguimiento real de tu evolución.
            </p>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: ClipboardList, t: "Valoración estructurada", d: "Una evaluación inicial seria, no un formulario genérico." },
              { icon: FileText, t: "Historia clínica real", d: "Tu proceso documentado y protegido, no notas sueltas." },
              { icon: Stethoscope, t: "Informes profesionales", d: "Documentos formales que puedes usar cuando los necesites." },
              { icon: ShieldCheck, t: "Estándar CIE-11", d: "Clasificación diagnóstica internacional, como en un hospital." },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.t} className="rounded-2xl bg-white/10 p-6 border border-white/10">
                  <Icon size={24} strokeWidth={1.5} />
                  <h3 className="mt-3 font-bold">{item.t}</h3>
                  <p className="mt-1.5 text-sm text-primary-foreground/70">{item.d}</p>
                </div>
              );
            })}
          </div>
        </div>
      </Reveal>

      {/* ── Guías destacadas (NUEVO — datos reales) ── */}
      {guias.length > 0 && (
        <Reveal as="section" className="bg-primary/5 py-16">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
              <div>
                <h2 className="text-3xl font-bold text-primary md:text-4xl drop-shadow-sm">
                  Guías destacadas
                </h2>
                <p className="mt-3 text-muted-foreground max-w-xl">
                  Recursos prácticos escritos por nuestro equipo clínico. Empieza a cuidarte hoy.
                </p>
              </div>
              <Link
                to="/guia"
                className="inline-flex items-center gap-1.5 rounded-xl border border-primary/20 px-5 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-primary/10"
              >
                Ver todas <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {guias.map((g) => (
                  <Link
                    key={g.id}
                    to="/guias/$guiaId"
                    params={{ guiaId: g.id }}
                    className="card-neon-hover group relative rounded-3xl border-border bg-white overflow-hidden p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl flex flex-col"
                  >
                    <div
                      className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-20 transition-opacity group-hover:opacity-30"
                      style={{ backgroundImage: `url('/guias/${g.imageName}')` }}
                    />
                    <div className="relative z-10 flex flex-col h-full">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="inline-block rounded-full bg-primary/10 border border-primary/10 px-3 py-1 text-xs font-bold text-primary">
                          {g.categoria}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-primary">{g.titulo}</h3>
                      <p className="mt-2 flex-1 text-sm text-foreground/80">{g.descripcionBreve}</p>
                      <span className="mt-4 text-xs font-semibold text-muted-foreground">
                        Lectura de {g.tiempoLectura}
                      </span>
                    </div>
                  </Link>
              ))}
            </div>
          </div>
        </Reveal>
      )}

      {/* ── Stats (existente) ── */}
      <Reveal as="section" className="bg-primary text-primary-foreground">
        <div className="mx-auto grid max-w-2xl gap-8 px-4 py-16 sm:grid-cols-2 md:px-6">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-4xl font-bold">{s.value}</div>
              <div className="mt-2 text-sm text-primary-foreground/70">{s.label}</div>
            </div>
          ))}
        </div>
      </Reveal>

      {/* ── FAQ corto (NUEVO) ── */}
      <Reveal as="section" className="mx-auto max-w-4xl px-4 py-16 md:px-6">
        <h2 className="text-center text-3xl font-bold text-primary md:text-4xl drop-shadow-sm">
          Preguntas frecuentes
        </h2>
        <div className="mt-8 space-y-3">
          {[
            { q: "¿Las sesiones son en línea?", a: "Sí, el acompañamiento es virtual. Algunas valoraciones específicas pueden requerir aplicación presencial; te lo indicamos si es tu caso." },
            { q: "¿Necesito un diagnóstico para empezar?", a: "No. Empiezas con una valoración inicial en la que entendemos tu situación y definimos juntos el mejor camino." },
            { q: "¿Es confidencial?", a: "Totalmente. Tu información clínica es privada y solo accesible para el profesional que te acompaña." },
          ].map((f) => (
            <details
              key={f.q}
              className="group rounded-2xl border border-white/50 bg-white/50 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-semibold text-foreground">
                {f.q}
                <ArrowRight size={16} className="text-primary transition-transform group-open:rotate-90" />
              </summary>
              <p className="px-5 pb-4 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
        <div className="mt-6 text-center">
          <Link to="/faq" className="text-sm font-bold text-primary hover:underline">
            Ver todas las preguntas frecuentes
          </Link>
        </div>
      </Reveal>

      {/* ── CTA final (existente) ── */}
      <Reveal as="section" className="mx-auto max-w-7xl px-4 pb-20 md:px-6">
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
      </Reveal>
    </>
  );
}
