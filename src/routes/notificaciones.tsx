// ============================================================================
// Centro de notificaciones.
//
// Una lista, en orden descendente, con el destino de cada aviso. Las acciones
// no inventan rutas: llevan a las que ya existen —la conversación, el recurso,
// el programa—, porque una notificación que abre una pantalla propia sería una
// segunda forma de navegar al mismo sitio.
//
// Abrir el destino marca el aviso como leído: si ya fuiste, ya no hace falta
// que te avise. También se puede marcar sin ir, desde la propia lista.
// ============================================================================
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { BookOpen, Check, Compass, Loader2, MessageCircle, UserPlus } from "lucide-react";
import {
  listNotifications,
  markAllAsRead,
  markAsRead,
  type AppNotification,
} from "../lib/api/notificationService";

export const Route = createFileRoute("/notificaciones")({
  head: () => ({
    meta: [{ title: "Notificaciones — Mente en Foco" }, { name: "robots", content: "noindex" }],
  }),
  component: Notificaciones,
});

const ICONO: Record<string, typeof BookOpen> = {
  CONTACT_REQUEST_CREATED: UserPlus,
  CONTACT_REQUEST_ACCEPTED: UserPlus,
  CONTACT_REQUEST_REJECTED: UserPlus,
  THERAPIST_ASSIGNED: UserPlus,
  MESSAGE_SENT: MessageCircle,
  NEXT_STEP_SHOWN: Compass,
  NEXT_STEP_OPENED: Compass,
};

/** "hace 5 minutos", sin dependencias ni horas exactas que nadie necesita. */
function haceCuanto(iso: string): string {
  const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutos < 1) return "ahora mismo";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.round(horas / 24);
  if (dias === 1) return "ayer";
  if (dias < 30) return `hace ${dias} días`;
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}

/**
 * A dónde lleva cada aviso, con las rutas que ya existen.
 *
 * `null` cuando no hay destino sensato —un rechazo no abre nada— o cuando el
 * aviso no trae recurso. Entonces la fila se muestra sin acción en vez de
 * ofrecer un enlace que no lleva a ningún sitio.
 */
function destino(n: AppNotification): { to: string; params?: Record<string, string> } | null {
  if (n.relationshipId && (n.eventType === "MESSAGE_SENT" || n.eventType === "THERAPIST_ASSIGNED")) {
    return { to: "/conversacion/$relationshipId", params: { relationshipId: n.relationshipId } };
  }
  if (n.eventType === "CONTACT_REQUEST_ACCEPTED" && n.relationshipId) {
    return { to: "/conversacion/$relationshipId", params: { relationshipId: n.relationshipId } };
  }
  if (!n.resourceId) return null;
  if (n.resourceType === "guia") return { to: "/guias/$guiaId", params: { guiaId: n.resourceId } };
  if (n.eventType === "NEXT_STEP_SHOWN" || n.eventType === "NEXT_STEP_OPENED") {
    return { to: "/contenido/$slug", params: { slug: n.resourceId } };
  }
  return null;
}

function Notificaciones() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setItems(await listNotifications(50));
    setCargando(false);
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function marcar(id: string) {
    setError(null);
    try {
      await markAsRead(id);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo marcar.");
    }
  }

  async function marcarTodas() {
    setError(null);
    try {
      await markAllAsRead();
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron marcar.");
    }
  }

  if (cargando) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={26} />
      </div>
    );
  }

  const sinLeer = items.filter((n) => !n.readAt).length;

  return (
    <section className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">Notificaciones</h1>
        {sinLeer > 0 && (
          <button
            type="button"
            onClick={marcarTodas}
            className="rounded-xl border border-primary/20 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/10"
          >
            Marcar todas como leídas
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {items.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No tienes notificaciones.</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {items.map((n) => {
            const Icono = ICONO[n.eventType] ?? BookOpen;
            const a = destino(n);
            const leida = Boolean(n.readAt);

            const contenido = (
              <div className="flex items-start gap-3">
                <span
                  className={`shrink-0 rounded-xl border p-2.5 ${
                    leida
                      ? "border-slate-200 bg-slate-50 text-slate-400"
                      : "border-primary/20 bg-primary/10 text-primary"
                  }`}
                >
                  <Icono size={17} strokeWidth={1.5} />
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm ${leida ? "font-semibold text-slate-600" : "font-bold text-slate-900"}`}
                  >
                    {n.title}
                  </p>
                  {n.body && <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-xs text-slate-400">
                    {haceCuanto(n.createdAt)} · {leida ? "Leída" : "Sin leer"}
                  </p>
                </div>
              </div>
            );

            return (
              <li
                key={n.id}
                className={`rounded-2xl border p-4 ${
                  leida ? "border-slate-200 bg-white" : "border-primary/20 bg-primary/5"
                }`}
              >
                {a ? (
                  <Link
                    to={a.to}
                    params={a.params}
                    onClick={() => {
                      // Abrir el destino la da por leída. Si falla, no se le
                      // cuenta a nadie: la navegación sigue.
                      if (!leida) void markAsRead(n.id).catch(() => {});
                    }}
                    className="block"
                  >
                    {contenido}
                  </Link>
                ) : (
                  contenido
                )}

                {!leida && (
                  <button
                    type="button"
                    onClick={() => marcar(n.id)}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-primary"
                  >
                    <Check size={13} /> Marcar como leída
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
