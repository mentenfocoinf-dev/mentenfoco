import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { Mail, Phone, MessageCircle, Bot, CheckCircle, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { z } from "zod";

export const Route = createFileRoute("/contactanos")({
  head: () => ({
    meta: [
      { title: "Contáctanos — Mente en Foco" },
      { name: "description", content: "Agenda una cita o ponte en contacto con nuestro equipo de salud mental." },
      { property: "og:title", content: "Contáctanos — Mente en Foco" },
      { property: "og:description", content: "Agenda una cita o ponte en contacto con nuestro equipo de salud mental." },
    ],
  }),
  component: Contactanos,
});

const channels = [
  { icon: Mail, label: "Email", value: "mentenfocoinf@gmail.com" },
  { icon: Phone, label: "Teléfono", value: "3186546057" },
  { icon: MessageCircle, label: "WhatsApp", value: "3186546057" },
  { icon: Bot, label: "Urgencias 24h", value: "Alex AI (Para VIP)" },
];

function Contactanos() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const fd = new FormData(e.currentTarget);
    const rawName     = `${fd.get("nombre") ?? ""} ${fd.get("apellido") ?? ""}`.trim();
    const rawEmail    = fd.get("email") as string;
    const rawPhone    = fd.get("phone") as string;
    const rawInterest = fd.get("motivo") as string;

    try {
      const { name, email, phone, interest } = z.object({
        name: z.string().min(2, "El nombre es muy corto").max(100, "El nombre es muy largo").regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, "El nombre contiene caracteres inválidos"),
        email: z.string().email("Correo electrónico inválido"),
        phone: z.string().max(20).optional().nullable(),
        interest: z.string().min(1),
      }).parse({ name: rawName, email: rawEmail, phone: rawPhone || null, interest: rawInterest });

      const { error } = await supabase.from("crm_leads").insert({
        name,
        email,
        phone,
        interest,
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
      if (err instanceof z.ZodError) {
        setErrorMsg(err.errors[0].message);
      } else {
        setErrorMsg("Error de validación inesperado.");
      }
    }
  }

  return (
    <>
      <section className="bg-[url('/BANNER.jpg')] bg-cover bg-center bg-no-repeat py-16 md:py-20">
        <div className="mx-auto max-w-4xl px-4 text-center glass-card mx-4 rounded-3xl py-16 shadow-lg border border-white/40">
          <h1 className="text-4xl font-bold text-primary md:text-5xl drop-shadow-sm">Contáctanos</h1>
          <p className="mt-4 text-muted-foreground">
            Estamos aquí para escucharte. Elige el canal que prefieras o déjanos un mensaje.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold text-primary drop-shadow-sm">Canales disponibles</h2>
            <div className="mt-6 space-y-4">
              {channels.map((c) => (
                <div key={c.label} className="card-neon-hover flex items-center gap-4 rounded-2xl glass-card p-5 transition-transform hover:scale-[1.01] hover:shadow-lg">
                  <div className="text-primary bg-primary/10 w-fit p-3 rounded-2xl backdrop-blur-md border border-primary/20">
                    <c.icon size={26} strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{c.label}</p>
                    <p className="mt-1 font-semibold text-foreground">{c.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card-neon-hover rounded-3xl glass bg-white/40 p-8 shadow-xl">
            <h2 className="text-2xl font-semibold text-primary">Envíanos un mensaje</h2>
            <p className="mt-1 text-sm text-muted-foreground">Te responderemos en menos de 24h.</p>

            {sent ? (
              <div className="mt-8 rounded-2xl bg-primary/10 border border-primary/20 p-8 text-center backdrop-blur-md">
                <div className="flex justify-center text-primary mb-2"><CheckCircle size={40} /></div>
                <p className="mt-2 font-bold text-primary text-xl">Mensaje enviado</p>
                <p className="mt-1 text-sm text-muted-foreground">Pronto nos pondremos en contacto.</p>
                <button
                  onClick={() => setSent(false)}
                  className="mt-4 text-xs text-primary underline hover:opacity-70"
                >
                  Enviar otro mensaje
                </button>
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
                    <label className="text-sm font-medium">Nombre</label>
                    <input name="nombre" required className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Apellido</label>
                    <input name="apellido" required className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <input name="email" type="email" required className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none" />
                </div>
                <div>
                  <label className="text-sm font-medium">Teléfono</label>
                  <input name="phone" type="tel" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none" />
                </div>
                <div>
                  <label className="text-sm font-medium">Motivo de consulta</label>
                  <select name="motivo" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none">
                    <option>Información general</option>
                    <option>Asesoramiento individual</option>
                    <option>Terapia infantil</option>
                    <option>Membresía</option>
                    <option>Otro</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-primary px-4 py-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-transform hover:scale-[1.02] shadow-lg shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><Loader2 size={16} className="animate-spin" /> Enviando…</>
                  ) : (
                    "Enviar mensaje"
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
