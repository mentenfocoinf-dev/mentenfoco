// ============================================================================
// Datos mínimos de operación.
//
// Cuatro campos, cada uno con su justificación a la vista: pedir la cédula sin
// explicar para qué, en una plataforma de salud mental, es exactamente el tipo
// de fricción que hace abandonar el registro.
//
// Alcance deliberadamente corto: la Resolución Única DIAN 000227 de 2025 solo
// permite exigir nombre, tipo/número de identificación y correo al comprador.
// No se pide dirección ni nada que no se vaya a usar.
// ============================================================================
import { createFileRoute } from "@tanstack/react-router";
import { META_NOINDEX } from "../lib/seo";
import { useState } from "react";
import { CreditCard, Loader2, Phone, ShieldAlert, UserCog } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";

export const Route = createFileRoute("/completar-perfil")({
  head: () => ({
    meta: [META_NOINDEX, { title: "Completa tu perfil — Mente en Foco" }],
  }),
  component: CompletarPerfil,
});

const inputClass =
  "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none transition-colors";

function Field({
  id,
  label,
  hint,
  icon,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  id: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <span className="text-primary">{icon}</span>
        {label}
      </label>
      <input
        id={id}
        type={type}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputClass}
      />
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{hint}</p>
    </div>
  );
}

function CompletarPerfil() {
  const { session, profile } = useAuth();
  const [cedula, setCedula] = useState(profile?.cedula ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [contactName, setContactName] = useState(profile?.emergency_contact_name ?? "");
  const [contactPhone, setContactPhone] = useState(profile?.emergency_contact_phone ?? "");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const complete = cedula.trim() && phone.trim() && contactName.trim() && contactPhone.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const userId = session?.user?.id;
    if (!userId || !complete) return;

    setSaving(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          cedula: cedula.trim(),
          phone: phone.trim(),
          emergency_contact_name: contactName.trim(),
          emergency_contact_phone: contactPhone.trim(),
        })
        .eq("id", userId);
      if (error) throw new Error(error.message);

      window.location.href = "/ingresa";
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "No pudimos guardar tus datos. Intenta de nuevo.",
      );
      setSaving(false);
    }
  }

  return (
    <section className="gradient-soft flex min-h-[85vh] w-full items-center justify-center px-4 py-10 md:px-6">
      <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <UserCog size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Completa tu perfil</h1>
            <p className="text-xs text-slate-500">
              Un paso rápido para poder acompañarte correctamente.
            </p>
          </div>
        </div>

        {errorMsg && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600"
          >
            {errorMsg}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
          <Field
            id="cedula"
            label="Número de identificación"
            hint="Lo necesitamos para poder facturarte cuando actives un plan pago. No se usa para nada más."
            icon={<CreditCard size={15} />}
            value={cedula}
            onChange={setCedula}
            placeholder="ej. 1020304050"
          />

          <Field
            id="phone"
            label="Tu teléfono"
            hint="Para confirmarte tus sesiones y contactarte si hay algún cambio en tu agenda."
            icon={<Phone size={15} />}
            value={phone}
            onChange={setPhone}
            placeholder="ej. 300 123 4567"
            type="tel"
          />

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ShieldAlert size={15} className="text-primary" />
              Contacto de emergencia
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Para que tu terapeuta sepa a quién avisar si llegara a ser necesario. Solo se usa en
              una situación de riesgo para tu seguridad.
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="contact-name" className="text-sm font-semibold text-slate-900">
                  Nombre
                </label>
                <input
                  id="contact-name"
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="ej. Ana Gómez"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="contact-phone" className="text-sm font-semibold text-slate-900">
                  Teléfono
                </label>
                <input
                  id="contact-phone"
                  type="tel"
                  required
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="ej. 301 987 6543"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={!complete || saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Guardando…
              </>
            ) : (
              "Guardar y continuar"
            )}
          </button>
        </form>
      </div>
    </section>
  );
}
