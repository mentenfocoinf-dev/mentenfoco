// ============================================================================
// "Tu terapeuta" — tarjeta del panel del paciente.
//
// Solo se dibuja si hay una relación activa. Sin terapeuta asignado no aparece
// nada: una tarjeta vacía que diga "todavía no tienes" es ruido, y el camino
// para conseguirlo ya vive en el bloque de acompañamiento de Mi camino.
// ============================================================================
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, MessageCircle, UserRound } from "lucide-react";
import {
  getMyTherapist,
  RELATIONSHIP_STATUS_LABELS,
  THEME_LABELS,
  type MyTherapist,
} from "../../lib/api";

export function TuTerapeutaCard() {
  const [relacion, setRelacion] = useState<MyTherapist | null>(null);

  useEffect(() => {
    let vigente = true;
    void getMyTherapist().then((r) => {
      if (vigente) setRelacion(r);
    });
    return () => {
      vigente = false;
    };
  }, []);

  if (!relacion) return null;

  return (
    <div className="card-neon-hover rounded-3xl glass-card border border-white/40 p-6">
      <div className="flex items-start gap-4">
        <span className="shrink-0 rounded-2xl border border-primary/20 bg-primary/10 p-3 text-primary">
          <UserRound size={22} strokeWidth={1.5} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Tu terapeuta</p>
          <h3 className="mt-1 text-lg font-bold text-primary">{relacion.therapistName}</h3>

          {relacion.specializations.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {relacion.specializations.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-[11px] font-semibold text-primary"
                >
                  {THEME_LABELS[t] ?? t}
                </span>
              ))}
            </div>
          )}

          <p className="mt-3 text-xs text-muted-foreground">
            {RELATIONSHIP_STATUS_LABELS[relacion.status]} desde el{" "}
            {new Date(relacion.assignedAt).toLocaleDateString("es-CO", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </p>

          {/* No existe todavía una página de perfil por profesional. Se enlaza
              a la del equipo en vez de a una ruta que no está construida. */}
          <div className="mt-4 flex flex-wrap gap-2">
            {/* Solo con relación activa: una conversación cerrada se lee desde
                su propio enlace, no se ofrece como acción del día a día. */}
            {relacion.status === "active" && (
              <Link
                to="/conversacion/$relationshipId"
                params={{ relationshipId: relacion.id }}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
              >
                <MessageCircle size={15} /> Abrir conversación
              </Link>
            )}
            <Link
              to="/sobre-nosotros"
              className="inline-flex items-center gap-2 rounded-xl border border-primary/20 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/10"
            >
              Ver perfil <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
