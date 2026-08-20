// ============================================================================
// Notificaciones.
//
// Cuatro funciones y ninguna más. Aquí no se CREA nada: las notificaciones
// nacen de triggers sobre las tablas donde ya ocurren los hechos —solicitudes,
// asignaciones, mensajes, eventos del recorrido—. Si el hecho se guardó, el
// aviso existe; no depende de que ninguna pantalla llegue a ejecutarse.
//
// El cliente no tiene INSERT ni SELECT sobre la tabla. Se lee por funciones que
// filtran por `auth.uid()`, y lo único que puede escribir es `read_at`: nadie
// puede fabricarle una notificación a otra persona ni leer las suyas.
// ============================================================================
import { supabase } from "../supabase";

/** El mismo nombre que el evento que la originó. Sin catálogo paralelo. */
export type NotificationEventType =
  | "CONTACT_REQUEST_CREATED"
  | "CONTACT_REQUEST_ACCEPTED"
  | "CONTACT_REQUEST_REJECTED"
  | "THERAPIST_ASSIGNED"
  | "MESSAGE_SENT"
  | "NEXT_STEP_SHOWN"
  | "NEXT_STEP_OPENED";

export interface AppNotification {
  id: string;
  eventType: NotificationEventType | string;
  title: string;
  body: string | null;
  resourceType: string | null;
  resourceId: string | null;
  relationshipId: string | null;
  readAt: string | null;
  createdAt: string;
}

/** Las propias, de más reciente a menos. Vacío sin sesión o si algo falla. */
export async function listNotifications(limite = 30): Promise<AppNotification[]> {
  const { data, error } = await supabase.rpc("list_my_notifications", { p_limit: limite });
  if (error || !data) return [];

  return (data as Record<string, string | null>[]).map((n) => ({
    id: n.id as string,
    eventType: n.event_type as NotificationEventType,
    title: (n.title as string) ?? "",
    body: n.body,
    resourceType: n.resource_type,
    resourceId: n.resource_id,
    relationshipId: n.relationship_id,
    readAt: n.read_at,
    createdAt: n.created_at as string,
  }));
}

/** Marca una como leída. El trigger comprueba que sea tuya. */
export async function markAsRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  if (error) {
    if (error.message.includes("NOTIFICATION_FORBIDDEN")) {
      throw new Error("Esta notificación no es tuya.");
    }
    throw new Error("No se pudo marcar la notificación.");
  }
}

/** Vacía la bandeja de una vez. */
export async function markAllAsRead(): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const id = session?.user?.id;
  if (!id) return;

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", id)
    .is("read_at", null);
  if (error) throw new Error("No se pudieron marcar las notificaciones.");
}

/** Cuántas sin leer. `0` sin sesión: el badge simplemente no aparece. */
export async function getUnreadCount(): Promise<number> {
  const { data, error } = await supabase.rpc("count_my_unread_notifications");
  if (error || typeof data !== "number") return 0;
  return data;
}
