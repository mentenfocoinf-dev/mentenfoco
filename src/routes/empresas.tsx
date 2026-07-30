import { createFileRoute } from "@tanstack/react-router";
import { HeroImagen } from "../components/HeroImagen";
import { useRef, useState } from "react";
import {
  Building2,
  HeartPulse,
  TrendingDown,
  Users,
  ShieldCheck,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { z } from "zod";
import { supabase } from "../lib/supabase";

// ============================================================================
// Landing B2B. El formulario de demo inyecta a crm_leads (misma tabla y patrón
// que contactanos.tsx), con interest = "Empresas (B2B)" para poder distinguir
// estos leads. Lenguaje de propuesta, sin cifras de clientes que MeF no tenga.
// ============================================================================

export const Route = createFileRoute("/empresas")({
  head: () => ({
    meta: [
      { title: "Empresas — Mente en Foco" },
      {
        name: "description",
        content:
          "Programas de bienestar mental para equipos: menos ausentismo, más compromiso. Agenda una demo.",
      },
    ],
  }),
  component: Empresas,
});

const VALUE_PROPS = [
  {
    icon: HeartPulse,
    title: "Bienestar real para tu equipo",
    desc: "Acceso a acompañamiento clínico y contenido de bienestar para tus colaboradores.",
  },
  {
    icon: TrendingDown,
    title: "Menos ausentismo",
    desc: "El bienestar emocional impacta directamente la asistencia y la productividad.",
  },
  {
    icon: Users,
    title: "Cultura que cuida",
    desc: "Un beneficio que comunica que la salud mental de tu gente importa de verdad.",
  },
  {
    icon: ShieldCheck,
    title: "Confidencialidad garantizada",
    desc: "Cada colaborador accede a su proceso de forma privada y protegida.",
  },
];

function Empresas() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const fd = new FormData(e.currentTarget);
    const rawName = `${fd.get("contacto") ?? ""}`.trim();
    const rawEmail = fd.get("email") as string;
    const rawPhone = fd.get("phone") as string;
    const empresa = `${fd.get("empresa") ?? ""}`.trim();

    try {
      const { name, email, phone } = z
        .object({
          name: z.string().min(2, "El nombre es muy corto").max(100),
          email: z.string().email("Correo electrónico inválido"),
          phone: z.string().max(20).optional().nullable(),
        })
        .parse({ name: rawName, email: rawEmail, phone: rawPhone || null });

      // El nombre de la empresa se guarda en `interest` para no depender de una
      // columna nueva: crm_leads ya existe y este es el mismo patrón de contacto.
      const { error } = await supabase.from("crm_leads").insert({
        name,
        email,
        phone,
        interest: `Empresas (B2B)${empresa ? ` — ${empresa}` : ""}`,
        status: "new",
      });

      setLoading(false);
      if (error) {
        console.error("[crm_leads] insert error:", error.message);
        setErrorMsg("Hubo un problema al enviar. Por favor intenta de nuevo.");
        return;
      }
      setSent(true);
      formRef.current?.reset();
    } catch (err) {
      setLoading(false);
      setErrorMsg(err instanceof z.ZodError ? err.errors[0].message : "Error de validación.");
    }
  }

  return (
    <>
      <HeroImagen image="/empresas.jpg">
        <div className="mx-auto max-w-4xl px-4 text-center glass-card mx-4 rounded-3xl py-14 shadow-lg border border-white/40">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20">
            <Building2 size={30} strokeWidth={1.5} />
          </div>
          <h1 className="mt-6 text-4xl font-bold text-primary md:text-5xl drop-shadow-sm">
            Bienestar mental para tu equipo
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Cuidar la salud mental de tus colaboradores es cuidar tu organización. Diseñamos
            programas de bienestar con el mismo estándar clínico de Mente en Foco.
          </p>
        </div>
      </HeroImagen>

      <section className="mx-auto max-w-6xl px-4 py-14 md:px-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {VALUE_PROPS.map((v) => {
            const Icon = v.icon;
            return (
              <div
                key={v.title}
                className="card-neon-hover rounded-3xl glass-card p-6 border border-white/40"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                  <Icon size={22} strokeWidth={1.5} />
                </div>
                <h2 className="mt-4 text-base font-bold text-primary">{v.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{v.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Formulario de demo → crm_leads */}
      <section className="bg-primary/5 py-16">
        <div className="mx-auto max-w-3xl px-4 md:px-6">
          <div className="card-neon-hover rounded-3xl glass bg-white/50 p-8 md:p-10 shadow-xl border border-white/40">
            <h2 className="text-2xl font-bold text-primary">Agenda una demo</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Cuéntanos sobre tu organización y diseñamos juntos una propuesta a la medida. Sin
              compromiso.
            </p>

            {sent ? (
              <div className="mt-8 rounded-2xl bg-primary/10 border border-primary/20 p-8 text-center">
                <div className="flex justify-center text-primary mb-2">
                  <CheckCircle size={40} />
                </div>
                <p className="mt-2 text-xl font-bold text-primary">Solicitud recibida</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Nuestro equipo se pondrá en contacto contigo muy pronto.
                </p>
              </div>
            ) : (
              <form ref={formRef} className="mt-6 space-y-4" onSubmit={handleSubmit}>
                {errorMsg && (
                  <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-600">
                    {errorMsg}
                  </p>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Nombre de contacto</label>
                    <input
                      name="contacto"
                      required
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Empresa</label>
                    <input
                      name="empresa"
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Email corporativo</label>
                  <input
                    name="email"
                    type="email"
                    required
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Teléfono</label>
                  <input
                    name="phone"
                    type="tel"
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-primary px-4 py-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-transform hover:scale-[1.02] shadow-lg shadow-primary/20 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Enviando…
                    </>
                  ) : (
                    "Solicitar demo"
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
