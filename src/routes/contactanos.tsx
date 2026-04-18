import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/contactanos")({
  head: () => ({
    meta: [
      { title: "Contáctanos — Mente Sana" },
      { name: "description", content: "Agenda una cita o ponte en contacto con nuestro equipo de salud mental." },
      { property: "og:title", content: "Contáctanos — Mente Sana" },
      { property: "og:description", content: "Agenda una cita o ponte en contacto con nuestro equipo de salud mental." },
    ],
  }),
  component: Contactanos,
});

const channels = [
  { icon: "📧", label: "Email", value: "contacto@mentesana.com" },
  { icon: "📞", label: "Teléfono", value: "+34 900 123 456" },
  { icon: "💬", label: "WhatsApp", value: "+34 600 111 222" },
  { icon: "📍", label: "Dirección", value: "Calle Bienestar 123, Madrid" },
  { icon: "🕐", label: "Horario", value: "Lun – Vie · 9:00 – 19:00" },
  { icon: "🚨", label: "Urgencias 24h", value: "+34 900 999 999" },
];

function Contactanos() {
  const [sent, setSent] = useState(false);

  return (
    <>
      <section className="gradient-soft">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center md:px-6 md:py-20">
          <h1 className="text-4xl font-bold text-primary md:text-5xl">Contáctanos</h1>
          <p className="mt-4 text-muted-foreground">
            Estamos aquí para escucharte. Elige el canal que prefieras o déjanos un mensaje.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold text-primary">Canales disponibles</h2>
            <div className="mt-6 space-y-4">
              {channels.map((c) => (
                <div key={c.label} className="flex items-start gap-4 rounded-xl border border-border bg-card p-5">
                  <div className="text-2xl">{c.icon}</div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{c.label}</p>
                    <p className="mt-1 font-medium text-foreground">{c.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
            <h2 className="text-2xl font-semibold text-primary">Envíanos un mensaje</h2>
            <p className="mt-1 text-sm text-muted-foreground">Te responderemos en menos de 24h.</p>

            {sent ? (
              <div className="mt-8 rounded-md bg-primary-soft p-6 text-center">
                <div className="text-3xl">✅</div>
                <p className="mt-2 font-medium text-primary">Mensaje enviado</p>
                <p className="mt-1 text-sm text-muted-foreground">Pronto nos pondremos en contacto.</p>
              </div>
            ) : (
              <form
                className="mt-6 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  setSent(true);
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Nombre</label>
                    <input required className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Apellido</label>
                    <input required className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <input type="email" required className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none" />
                </div>
                <div>
                  <label className="text-sm font-medium">Teléfono</label>
                  <input type="tel" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none" />
                </div>
                <div>
                  <label className="text-sm font-medium">Motivo de consulta</label>
                  <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none">
                    <option>Información general</option>
                    <option>Asesoramiento individual</option>
                    <option>Terapia infantil</option>
                    <option>Membresía</option>
                    <option>Otro</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Mensaje</label>
                  <textarea required rows={4} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none" />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Enviar mensaje
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
