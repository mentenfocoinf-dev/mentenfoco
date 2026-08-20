// ============================================================================
// Bloqueos y vacaciones del profesional.
//
// Vacaciones y bloqueo puntual son la misma cosa —un rango en el que no se
// atiende— con distinta etiqueta. Por eso comparten tabla: dos tablas para el
// mismo hecho acaban aplicándose en sitios distintos.
//
// Ninguna regla vive aquí. Que el rango sea futuro, que no pise nada agendado y
// que solo el dueño lo toque lo impone `enforce_time_block_ownership`. El
// `therapist_id` no se envía nunca: lo deriva la base de `auth.uid()`.
//
// La lectura va por función porque el cliente NO tiene SELECT sobre la tabla:
// saber cuándo se ausenta un profesional no es asunto de nadie más.
// ============================================================================
import { supabase } from "../supabase";

export type AgendaBlockKind = "vacaciones" | "bloqueo";

export const BLOCK_KIND_LABELS: Record<AgendaBlockKind, string> = {
  vacaciones: "Vacaciones",
  bloqueo: "Bloqueo",
};

export interface TimeBlock {
  id: string;
  startsAt: string;
  endsAt: string;
  kind: AgendaBlockKind;
  reason: string | null;
}

const MENSAJES_DE_ERROR: [string, string][] = [
  ["BLOCK_FORBIDDEN", "Ese bloqueo no es tuyo."],
  ["BLOCK_IN_THE_PAST", "No se puede bloquear un rango que ya pasó."],
  [
    "BLOCK_OVERLAPS_AGENDA",
    "Tienes citas o sesiones dentro de ese rango. Resuélvelas antes de bloquearlo.",
  ],
  ["blocks_intervalo_valido", "La fecha de fin debe ser posterior a la de inicio."],
  ["blocks_duracion_razonable", "Un bloqueo no puede durar más de 120 días."],
  ["blocks_reason_check", "El motivo es demasiado largo."],
];

function traducir(mensaje: string): Error {
  const encontrado = MENSAJES_DE_ERROR.find(([codigo]) => mensaje.includes(codigo));
  return new Error(encontrado ? encontrado[1] : "No se pudo guardar el bloqueo.");
}

/** Los bloqueos de quien tiene la sesión abierta, dentro de una ventana. */
export async function listMyTimeBlocks(desde?: string, hasta?: string): Promise<TimeBlock[]> {
  const { data, error } = await supabase.rpc("list_my_time_blocks", {
    ...(desde ? { p_desde: desde } : {}),
    ...(hasta ? { p_hasta: hasta } : {}),
  });
  if (error || !data) return [];
  return (data as Record<string, string>[]).map((b) => ({
    id: b.id,
    startsAt: b.starts_at,
    endsAt: b.ends_at,
    kind: b.kind as AgendaBlockKind,
    reason: b.reason ?? null,
  }));
}

export async function createTimeBlock(input: {
  startsAt: string;
  endsAt: string;
  kind: AgendaBlockKind;
  reason?: string | null;
}): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const quien = session?.user?.id;
  if (!quien) throw new Error("Necesitas iniciar sesión.");

  const { error } = await supabase.from("therapist_time_blocks").insert({
    // El trigger lo sobrescribe con auth.uid(); va porque la columna es NOT NULL.
    therapist_id: quien,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    kind: input.kind,
    reason: input.reason?.trim() ? input.reason.trim().slice(0, 300) : null,
  });
  if (error) throw traducir(error.message);
}

export async function deleteTimeBlock(id: string): Promise<void> {
  const { error } = await supabase.from("therapist_time_blocks").delete().eq("id", id);
  if (error) throw traducir(error.message);
}
