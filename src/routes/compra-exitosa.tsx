import { createFileRoute, Link } from "@tanstack/react-router";
import { META_NOINDEX } from "../lib/seo";
import { CheckCircle2, ArrowRight, Mail, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/compra-exitosa")({
  head: () => ({
    meta: [
      META_NOINDEX,
      { title: "¡Compra Exitosa! — Mente en Foco" },
      {
        name: "description",
        content: "Tu pago fue procesado exitosamente. Revisa tu correo para activar tu cuenta.",
      },
    ],
  }),
  component: CompraExitosa,
});

function CompraExitosa() {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 py-16">
      <div className="card-neon-hover w-full max-w-lg rounded-3xl glass bg-white/60 p-10 text-center shadow-xl">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-inner ring-4 ring-emerald-50">
          <CheckCircle2 size={40} strokeWidth={2} />
        </div>

        <h1 className="mt-8 text-3xl font-bold text-slate-900">Tu acompañamiento ya está listo</h1>
        <p className="mt-3 text-slate-500 text-sm">
          Tu pago quedó confirmado. Te damos la bienvenida a tu proceso.
        </p>

        {/* Paso 1: Revisar email */}
        <div className="mt-6 rounded-2xl bg-white/50 p-6 text-left shadow-sm border border-slate-100">
          <div className="flex items-start gap-4">
            <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Mail size={18} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Revisa tu correo electrónico</h3>
              <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                En los próximos minutos recibirás un correo con un enlace para{" "}
                <strong>activar tu cuenta y establecer tu contraseña</strong>. Por seguridad el
                enlace caduca al cabo de un rato; si expira, puedes pedir uno nuevo desde
                “¿Olvidaste tu contraseña?”.
              </p>
            </div>
          </div>
        </div>

        {/* Paso 2: Acceder */}
        <div className="mt-4 rounded-2xl bg-primary/5 p-6 text-left border border-primary/10">
          <div className="flex items-start gap-4">
            <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Beneficios activados automáticamente</h3>
              <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                Una vez que confirmes tu cuenta, tendrás acceso a las guías clínicas, a tu espacio
                personal y a los recursos de tu etapa.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/ingresa"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:bg-primary/90"
          >
            Ir al Portal de Usuarios <ArrowRight size={18} />
          </Link>
        </div>

        <p className="mt-6 text-xs text-slate-400">
          ¿No recibiste el correo? Revisa tu carpeta de spam o{" "}
          <Link to="/contactanos" className="text-primary underline hover:opacity-75">
            contáctanos
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
