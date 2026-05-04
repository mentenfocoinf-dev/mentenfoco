import { createFileRoute } from "@tanstack/react-router";
import { ChevronRight, ChevronDown } from "lucide-react";

export const Route = createFileRoute("/sobre-nosotros")({
  head: () => ({
    meta: [
      { title: "Sobre nosotros — Mente en Foco" },
      { name: "description", content: "Conoce nuestro equipo, misión y valores en el cuidado de la salud mental." },
      { property: "og:title", content: "Sobre nosotros — Mente en Foco" },
      { property: "og:description", content: "Conoce nuestro equipo, misión y valores en el cuidado de la salud mental." },
    ],
  }),
  component: SobreNosotros,
});

const values = [
  { title: "Empatía", desc: "Escuchamos sin juzgar. Cada historia merece comprensión.", image: "/images/empatia.jpg" },
  { title: "Profesionalismo", desc: "Equipo certificado con formación continua.", image: "/images/profesionalismo.jpg" },
  { title: "Confidencialidad", desc: "Tu privacidad es absoluta. Siempre.", image: "/images/confidencialidad.jpg" },
  { title: "Cercanía", desc: "Trato humano, accesible y sin tecnicismos innecesarios.", image: "/images/cercania.jpg" },
];

const team = [
  { name: "Dr. Santiago Gonzalez", role: "Neuropsicólogo Clínico", years: "10 Años de experiencia" },
];

function SobreNosotros() {
  return (
    <>
      <section className="bg-[url('/BANNER.jpg')] bg-cover bg-center bg-no-repeat py-16 md:py-20">
        <div className="mx-auto max-w-5xl px-4 text-center glass-card mx-4 rounded-3xl py-16 shadow-lg border border-white/40">
          <h1 className="text-4xl font-bold text-primary md:text-5xl drop-shadow-sm">No tratamos síntomas, potenciamos vidas</h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-3xl mx-auto">
            Somos un centro clínico donde la excelencia profesional se une con el calor humano. Nuestra misión es cuidar de tu bienestar y el de tu familia de forma integral, dándote herramientas para superar cualquier reto.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="card-neon-hover rounded-3xl glass-card p-10 shadow-xl shadow-primary/5 transition-transform hover:scale-[1.01]">
            <h2 className="text-2xl font-semibold text-primary">Trabajo en Equipo</h2>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              Nuestro equipo de especialistas trabaja unido para ti. Psiquiatras, psicólogos y fonoaudiólogos analizamos cada caso en conjunto para crear un plan de tratamiento único y efectivo que realmente te ayude a avanzar.
            </p>
          </div>
          <div className="card-neon-hover rounded-3xl glass-card p-10 shadow-xl shadow-primary/5 transition-transform hover:scale-[1.01]">
            <h2 className="text-2xl font-semibold text-primary">El Factor Humano</h2>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              Detrás de cada especialista, hay un ser humano listo para escucharte. Creemos profundamente en acompañarte con empatía, validando tus emociones sin juicios y con un genuino deseo de verte mejor.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-primary/5 py-16">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-primary md:text-4xl">Ruta de Intervención Clínica</h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              Un abordaje protocolizado que garantiza la más alta precisión diagnóstica y terapéutica para cada paciente.
            </p>
          </div>
          
          <div className="flex flex-col md:flex-row gap-4 lg:gap-6 items-center md:items-stretch relative">
            
            <div className="flex-1 relative glass-card p-8 rounded-3xl text-center border border-white/60 shadow-lg w-full transition-transform hover:-translate-y-1">
              <div className="w-16 h-16 mx-auto bg-primary text-primary-foreground rounded-2xl flex items-center justify-center text-2xl font-bold mb-6 shadow-xl shadow-primary/20">1</div>
              <h3 className="text-xl font-bold text-primary mb-3">Valoración Inicial</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Nuestra primera meta es escucharte y entenderte a fondo. Realizamos una evaluación inicial cálida y profesional para saber exactamente qué necesitas y cómo podemos ayudarte mejor.
              </p>
            </div>

            <div className="hidden md:flex items-center justify-center text-primary/40 mt-12">
              <ChevronRight size={36} strokeWidth={2} />
            </div>
            <div className="flex md:hidden items-center justify-center text-primary/40 my-2">
              <ChevronDown size={36} strokeWidth={2} />
            </div>

            <div className="flex-1 relative glass-card p-8 rounded-3xl text-center border border-white/60 shadow-lg w-full md:-translate-y-4 transition-transform hover:-translate-y-5">
              <div className="w-16 h-16 mx-auto bg-primary text-primary-foreground rounded-2xl flex items-center justify-center text-2xl font-bold mb-6 shadow-xl shadow-primary/20">2</div>
              <h3 className="text-xl font-bold text-primary mb-3">Análisis en Equipo</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                No estás en manos de una sola persona. Todos nuestros especialistas se reúnen para estudiar tu situación y diseñar en conjunto el mejor camino hacia tu tranquilidad.
              </p>
            </div>

            <div className="hidden md:flex items-center justify-center text-primary/40 mt-12 md:-translate-y-4">
              <ChevronRight size={36} strokeWidth={2} />
            </div>
            <div className="flex md:hidden items-center justify-center text-primary/40 my-2">
              <ChevronDown size={36} strokeWidth={2} />
            </div>

            <div className="flex-1 relative glass-card p-8 rounded-3xl text-center border border-white/60 shadow-lg w-full transition-transform hover:-translate-y-1">
              <div className="w-16 h-16 mx-auto bg-primary text-primary-foreground rounded-2xl flex items-center justify-center text-2xl font-bold mb-6 shadow-xl shadow-primary/20">3</div>
              <h3 className="text-xl font-bold text-primary mb-3">Acompañamiento Constante</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Comenzamos tu proceso con herramientas probadas que realmente funcionan. Te acompañamos a ti y a tu familia paso a paso, celebrando juntos cada avance que logres.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <h2 className="text-center text-3xl font-bold text-primary">Nuestros valores</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((v) => (
            <div key={v.title} className="card-neon-hover rounded-3xl glass-card overflow-hidden text-center transition-all duration-300 hover:scale-105 hover:shadow-xl flex flex-col">
              <div className="h-48 w-full overflow-hidden bg-muted">
                <img src={v.image} alt={v.title} className="h-full w-full object-cover transition-transform duration-500 hover:scale-105" />
              </div>
              <div className="p-8 flex-1 flex flex-col">
                <h3 className="text-lg font-semibold text-primary">{v.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{v.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-primary/5 py-16">
        <div className="mx-auto max-w-7xl px-4 py-16 md:px-6 glass-card rounded-3xl border border-white/40 shadow-xl shadow-primary/5">
          <h2 className="text-center text-3xl font-bold text-primary drop-shadow-sm">Nuestro equipo</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
            Profesionales colegiados con amplia experiencia en neuropsicología y bienestar mental.
          </p>
          <div className="mt-10 flex justify-center">
            {team.map((m) => (
              <div key={m.name} className="card-neon-hover rounded-3xl glass bg-white/40 p-10 text-center transition-transform hover:scale-105 hover:shadow-xl w-full max-w-sm">
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-primary shadow-lg shadow-primary/30 text-3xl text-primary-foreground font-bold">
                  {m.name.split(" ")[1]?.[0]}{m.name.split(" ")[2]?.[0]}
                </div>
                <h3 className="mt-6 text-xl font-bold text-primary">{m.name}</h3>
                <p className="mt-2 text-sm text-foreground font-medium">{m.role}</p>
                <p className="mt-1 text-sm text-muted-foreground">{m.years}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
