// ============================================================================
// Journey Engine — registro del recorrido del usuario.
//
// Infraestructura interna. NO muestra nada, NO añade fricción y NO puede
// interrumpir a nadie: si el registro falla, la persona jamás se entera.
//
// ── Qué NO se guarda, y por qué ─────────────────────────────────────────────
//
// Nada de respuestas, nada de texto libre, nada de IP, nada de user agent
// completo. `metadata` es para identificadores y números; la base tiene un tope
// de 2 KB precisamente para que no quepa un texto.
//
// La razón no es prudencia genérica: la secuencia de eventos de una persona es
// información de salud de facto. Saber que alguien leyó la guía de ideación y
// después abrió las líneas de crisis dice tanto como una respuesta de un
// cuestionario. Por eso se recoge lo mínimo que permite entender el recorrido, y
// ni un dato más (ADR-005, y "pedir datos innecesarios" en la constitución).
//
// ── Identidad sin fingerprinting ────────────────────────────────────────────
//
// `anonymous_id`  UUID aleatorio en localStorage. Persiste entre visitas.
// `session_id`    UUID aleatorio en sessionStorage. Muere al cerrar la pestaña.
//
// Ambos son generados por nosotros, no derivados del dispositivo: no hay canvas,
// ni fuentes, ni resolución, ni ninguna otra señal. Si alguien borra su
// almacenamiento, es una persona nueva — y eso está bien.
// ============================================================================
import { supabase } from "../supabase";

const ANON_KEY = "mf_anonymous_id";
const SESSION_KEY = "mf_session_id";

/** Catálogo cerrado. Un nombre libre acaba en tres variantes del mismo evento. */
export type JourneyEventName =
  // Navegación pública
  | "HOME_VIEW"
  | "SERVICES_VIEW"
  | "BLOG_VIEW"
  | "GUIDE_VIEW"
  | "CONTENT_VIEW"
  | "PLAN_VIEWED"
  // Tests públicos
  | "TEST_STARTED"
  | "TEST_COMPLETED"
  | "TEST_RESULT_VIEWED"
  // Cuenta
  | "ACCOUNT_CREATED"
  | "LOGIN"
  | "LOGOUT"
  | "CONSENT_ACCEPTED"
  // Intención
  | "CONTACT_FORM_SENT"
  | "SESSION_BOOKING_STARTED"
  // Recomendaciones. Sin estos dos es imposible medir qué reglas sirven.
  | "RECOMMENDATION_SHOWN"
  | "RECOMMENDATION_ACCEPTED"
  // Siguiente paso. Distinto de una recomendación: no es "también te puede
  // servir", es "continúa por aquí" dentro de una ruta que ya empezaste.
  | "NEXT_STEP_SHOWN"
  | "NEXT_STEP_OPENED"
  // Matching clínico. Sin estos dos no hay forma de saber si derivar por reglas
  // acierta o no.
  | "MATCHING_SHOWN"
  | "MATCHING_SELECTED"
  // Onboarding. Cuántos temas y qué busca; nunca cuáles ni por qué.
  | "ONBOARDING_COMPLETED"
  // Solicitudes de contacto con un profesional. Identificadores y estado, nunca
  // el mensaje que la persona escribió.
  | "CONTACT_REQUEST_CREATED"
  | "CONTACT_REQUEST_ACCEPTED"
  | "CONTACT_REQUEST_REJECTED"
  | "CONTACT_REQUEST_CANCELLED"
  // Relación formal paciente ↔ terapeuta.
  | "THERAPIST_ASSIGNED"
  | "THERAPIST_RELATIONSHIP_FINISHED"
  | "THERAPIST_RELATIONSHIP_CANCELLED"
  // Mensajería. Identificadores, nunca el texto del mensaje.
  | "MESSAGE_SENT"
  | "MESSAGE_READ";

/**
 * Metadatos permitidos. Deliberadamente estrecho: si un evento necesita un campo
 * nuevo, se añade aquí a conciencia y no por descuido en una llamada suelta.
 */
export interface JourneyMetadata {
  /** Slug o id de la pieza vista. Nunca su contenido. */
  resource_id?: string;
  /** Tipo de la pieza: 'guia' | 'articulo' | 'programa' | 'blog'… */
  resource_type?: string;
  /** Test público: su slug. */
  test_id?: string;
  /** Test público: puntaje total. Nunca las respuestas. */
  score?: number;
  /** Test público: etiqueta de la banda. */
  band?: string;
  /** Test público: si se llegó al final. */
  completed?: boolean;
  /** Etapa consultada, por su identificador técnico. */
  plan?: string;
  /** Cuántas recomendaciones se mostraron. */
  count?: number;
  /** Qué regla del motor las produjo. */
  rule?: string;
  /** Siguiente paso: su posición dentro del programa. Nunca cuántos van. */
  step_order?: number;
  [key: string]: string | number | boolean | undefined;
}

interface UtmParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

const isBrowser = () => typeof window !== "undefined";

/** UUID sin depender de crypto.randomUUID, que no existe en contextos no seguros. */
function uuid(): string {
  if (isBrowser() && typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Identificador anónimo persistente. Se crea la primera vez y se reutiliza.
 *
 * Todo acceso a storage va envuelto: en modo privado de Safari, con cookies
 * bloqueadas o dentro de un iframe restringido, `localStorage` lanza. Y esta
 * función jamás puede romper una página.
 */
export function getAnonymousId(): string | null {
  if (!isBrowser()) return null;
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id = uuid();
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

/** Identificador de visita. Muere al cerrar la pestaña, por diseño. */
export function getSessionId(): string {
  if (!isBrowser()) return "server";
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = uuid();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    // Sin storage se genera uno por llamada: se pierde la agrupación por visita,
    // pero el evento se registra igual. Degradar es mejor que no registrar.
    return uuid();
  }
}

/**
 * Categoría de dispositivo, NO el user agent completo.
 *
 * La cadena completa es un vector de fingerprinting y el sprint lo prohíbe. La
 * categoría responde la única pregunta que de verdad importa —dónde se usa el
 * producto— sin aportar nada que identifique a nadie.
 */
function deviceCategory(): string | null {
  if (!isBrowser()) return null;
  const ua = navigator.userAgent;
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) return "mobile";
  return "desktop";
}

/** UTM de la URL actual. Solo las cinco estándar; el resto se ignora. */
function readUtm(): UtmParams {
  if (!isBrowser()) return {};
  try {
    const q = new URLSearchParams(window.location.search);
    const out: UtmParams = {};
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const) {
      const v = q.get(k);
      // Tope defensivo: un utm gigante es un intento de meter algo que no es un utm.
      if (v) out[k] = v.slice(0, 120);
    }
    return out;
  } catch {
    return {};
  }
}

/** Referrer externo. Se descarta la navegación interna: es ruido. */
function readReferrer(): string | null {
  if (!isBrowser()) return null;
  try {
    const ref = document.referrer;
    if (!ref) return null;
    if (new URL(ref).host === window.location.host) return null;
    return ref.slice(0, 500);
  } catch {
    return null;
  }
}

// ── Deduplicación ───────────────────────────────────────────────────────────
//
// Dos fuentes de duplicados, ambas reales:
//  1. StrictMode monta cada componente dos veces en desarrollo, así que un
//     efecto de "vista de página" se dispara dos veces. Ya pasó con el registro
//     de los tests públicos.
//  2. Un usuario que va y vuelve entre dos rutas genera un HOME_VIEW por cada
//     regreso, y eso no es información nueva.
//
// Se resuelve con una ventana de silencio por clave (evento + página + recurso).
// En memoria: no se persiste, porque una recarga real sí es una vista nueva.
const DEDUPE_WINDOW_MS = 2000;
const lastSeen = new Map<string, number>();

function isDuplicate(key: string): boolean {
  const now = Date.now();
  const prev = lastSeen.get(key);
  if (prev !== undefined && now - prev < DEDUPE_WINDOW_MS) return true;
  lastSeen.set(key, now);
  // La caché no crece sin control en una sesión larga.
  if (lastSeen.size > 200) {
    for (const [k, t] of lastSeen) {
      if (now - t > DEDUPE_WINDOW_MS) lastSeen.delete(k);
    }
  }
  return false;
}

/**
 * Registra un evento del recorrido.
 *
 * **No se espera.** Devuelve `void`, no una promesa: quien la llama no puede
 * bloquear la navegación esperándola aunque quiera. Cualquier fallo —red caída,
 * tabla inexistente, permisos— se traga sin ruido en producción.
 *
 * Se llama sin `await`:
 *   trackEvent("GUIDE_VIEW", { resource_id: guia.id });
 */
export function trackEvent(
  eventName: JourneyEventName,
  metadata: JourneyMetadata = {},
  options: { page?: string } = {},
): void {
  if (!isBrowser()) return; // SSR: el recorrido es del navegador, no del servidor

  const page = options.page ?? window.location.pathname;
  const dedupeKey = `${eventName}|${page}|${metadata.resource_id ?? ""}|${metadata.test_id ?? ""}`;
  if (isDuplicate(dedupeKey)) return;

  // Se lanza en segundo plano y se olvida. El `void` es explícito: nada de lo
  // que pase aquí dentro puede llegar al usuario.
  void enviar(eventName, metadata, page);
}

async function enviar(
  eventName: JourneyEventName,
  metadata: JourneyMetadata,
  page: string,
): Promise<void> {
  try {
    // La sesión se lee de lo que ya hay en memoria: `getSession()` no va a la
    // red, a diferencia de `getUser()`. Un evento de navegación no puede costar
    // una petición extra.
    const {
      data: { session },
    } = await supabase.auth.getSession();

    await supabase.from("journey_events").insert({
      user_id: session?.user?.id ?? null,
      // Se conserva aunque haya sesión: permite unir el recorrido previo al
      // registro con el posterior, que es justo lo que el Sprint 2 va a querer.
      anonymous_id: getAnonymousId(),
      session_id: getSessionId(),
      event_name: eventName,
      page: page.slice(0, 300),
      source: "web",
      metadata,
      // ip_hash se deja null a propósito. Ver la migración.
      user_agent: deviceCategory(),
      referrer: readReferrer(),
      ...readUtm(),
    });
  } catch (err) {
    // Silencio en producción: el usuario nunca se entera de que esto falló.
    if (import.meta.env.DEV) console.warn("[journey] evento no registrado:", err);
  }
}

// ── Siguiente paso ──────────────────────────────────────────────────────────
//
// "También te puede servir" y "tu siguiente paso" no son lo mismo. El primero
// sugiere de lado; este continúa una ruta que un profesional ya ordenó, y por eso
// es UNO solo y no una lista: ofrecer tres siguientes pasos es no tener ninguno.
//
// No hay modelo nuevo detrás. El progreso ya está en journey_events —abrir una
// pieza es la señal— y los pasos ya están en `program_steps`. Esto solo cruza lo
// que existe.

/** Un paso del programa, tal como viene de `program_steps`. */
export interface JourneyStepInput {
  orden: number;
  titulo: string;
  descripcion?: string;
  slug_relacionado?: string | null;
  ref_kind?: "contenido" | "guia" | null;
}

export interface JourneyNextStepResult {
  orden: number;
  titulo: string;
  descripcion: string | null;
  /** Ruta ya resuelta: el componente no construye URLs. */
  href: string;
  resourceId: string;
  resourceType: "contenido" | "guia";
  /** `false` cuando ya se abrió algún paso: cambia "empezar" por "continuar". */
  empezado: boolean;
}

/**
 * Qué recursos de los indicados ha abierto ya quien está mirando.
 *
 * Va por RPC y no por consulta directa porque el cliente NO tiene SELECT sobre
 * journey_events, y no debe tenerlo: con RLS desactivado eso dejaría leer el
 * recorrido de cualquiera. La función filtra por `auth.uid()` internamente.
 *
 * Sin sesión devuelve vacío, y cualquier fallo también: no saber el progreso
 * significa empezar por el principio, nunca romper la página.
 */
export async function getSeenResources(resourceIds: string[]): Promise<string[]> {
  if (resourceIds.length === 0) return [];
  try {
    const { data, error } = await supabase.rpc("journey_seen_resources", {
      p_resource_ids: resourceIds,
    });
    if (error || !data) return [];
    return (data as { resource_id: string | null }[])
      .map((r) => r.resource_id)
      .filter((id): id is string => Boolean(id));
  } catch {
    return [];
  }
}

/** Un recurso que la persona abrió, con cuándo lo hizo. */
export interface RecentResource {
  resourceId: string;
  /** content_type de la pieza, o 'guia'. Tal como se registró. */
  resourceType: string;
  lastSeenAt: string;
}

/**
 * Lo último que abrió quien tiene la sesión abierta, de más reciente a menos.
 *
 * Va por RPC por lo mismo que `getSeenResources`: el cliente no tiene SELECT
 * sobre journey_events, y la función filtra por `auth.uid()` internamente.
 * Sin sesión devuelve vacío, y cualquier fallo también.
 */
export async function getRecentResources(limite = 5): Promise<RecentResource[]> {
  try {
    const { data, error } = await supabase.rpc("journey_recent_resources", {
      p_limit: limite,
    });
    if (error || !data) return [];
    return (data as { resource_id: string; resource_type: string | null; last_seen_at: string }[])
      .filter((r) => Boolean(r.resource_id))
      .map((r) => ({
        resourceId: r.resource_id,
        resourceType: r.resource_type ?? "",
        lastSeenAt: r.last_seen_at,
      }));
  } catch {
    return [];
  }
}

/**
 * El siguiente paso del programa, o `null` si no hay ninguno que ofrecer.
 *
 * Devuelve `null` en tres situaciones distintas que comparten la misma respuesta
 * —no dibujar nada— porque un CTA vacío o falso es peor que ninguno:
 *
 *   · el programa no tiene pasos enlazables dentro de la etapa del lector. Nunca
 *     se ofrece un paso que llevaría a "no encontrado";
 *   · ya se abrieron todos: el programa está terminado y no hay nada que empujar;
 *   · no hay programa.
 *
 * Un paso sin enlace —"haz tu GAD-7"— no es candidato: se muestra igual en la
 * lista de pasos, pero no puede ser el destino de un botón.
 */
export function resolveNextStep(
  steps: JourneyStepInput[] | null | undefined,
  alcanzables: string[],
  vistos: string[],
): JourneyNextStepResult | null {
  if (!steps || steps.length === 0) return null;

  const alcanzable = new Set(alcanzables);
  const visto = new Set(vistos);

  const abribles = [...steps]
    .sort((a, b) => a.orden - b.orden)
    .filter(
      (s) =>
        Boolean(s.slug_relacionado) &&
        (s.ref_kind === "contenido" || s.ref_kind === "guia") &&
        alcanzable.has(s.slug_relacionado as string),
    );

  if (abribles.length === 0) return null;

  const siguiente = abribles.find((s) => !visto.has(s.slug_relacionado as string));
  if (!siguiente) return null; // terminado

  const id = siguiente.slug_relacionado as string;
  const tipo = siguiente.ref_kind as "contenido" | "guia";
  return {
    orden: siguiente.orden,
    titulo: siguiente.titulo,
    descripcion: siguiente.descripcion ?? null,
    href: tipo === "guia" ? `/guias/${id}` : `/contenido/${id}`,
    resourceId: id,
    resourceType: tipo,
    empezado: abribles.some((s) => visto.has(s.slug_relacionado as string)),
  };
}

/** Limpia el identificador de visita. Se llama al cerrar sesión. */
export function resetJourneySession(): void {
  if (!isBrowser()) return;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* sin storage no hay nada que limpiar */
  }
  lastSeen.clear();
}
