// ============================================================================
// La ficha de trabajo de una sesión.
//
// Todo lo que el profesional necesita hacer con una sesión ocurre aquí: ver con
// quién, cuándo, cuánto dura, en qué estado está, entrar a la videollamada,
// copiar el enlace, corregirlo, dejar la observación y cerrarla. Sin cambiar de
// pantalla, porque cada salto es una ocasión de perder el hilo entre paciente y
// paciente.
//
// Es el MISMO componente en la sección "Agenda" y en "Agenda clínica". Tener dos
// fichas parecidas es cómo se llegó a que una cambiara el estado de la sesión y
// la otra el de la cita.
//
// ── Sobre la modalidad ──────────────────────────────────────────────────────
//
// No hay modalidad por sesión en el modelo: ni `therapy_sessions`, ni
// `appointments`, ni `patient_therapist` la guardan. Lo único que existe es lo
// que cada parte declara en general. Así que aquí se muestra DERIVADA del
// enlace, y etiquetada como tal — inventar un dato clínico-operativo que nadie
// eligió sería peor que decir que no está definido.
// ============================================================================
import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  Copy,
  Link2,
  NotebookPen,
  Video,
} from "lucide-react";
import { SESSION_STATUS_LABELS, type TherapistSessionRow } from "../../lib/api";
import { LineaDeTiempo, construirHitos } from "./LineaDeTiempo";

/** Lo que la ficha necesita saber del contexto de la sesión, ya resuelto fuera. */
export interface ContextoSesion {
  /** La solicitud que la originó era una contraoferta del profesional. */
  desdeContraoferta: boolean;
  /** La sesión anterior con el mismo paciente, si la hay. */
  anterior?: TherapistSessionRow;
  /** Y la siguiente. */
  siguiente?: TherapistSessionRow;
}

/** Un enlace de videollamada tiene que ser una URL. No se valida el proveedor. */
export const enlaceValido = (v: string) => /^https?:\/\/\S+\.\S+/i.test(v.trim());

const CLASE_ESTADO: Record<string, string> = {
  programada: "border-primary/30 bg-primary/10 text-primary",
  confirmada: "border-emerald-200 bg-emerald-50 text-emerald-700",
  completada: "border-slate-200 bg-slate-50 text-slate-600",
  cancelada: "border-slate-200 bg-slate-50 text-slate-400",
  no_asistio: "border-amber-200 bg-amber-50 text-amber-700",
};

const fechaLarga = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CO", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

const horaDe = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

function rangoHorario(iso: string, minutos: number): string {
  const fin = new Date(new Date(iso).getTime() + minutos * 60000);
  return `${horaDe(iso)} – ${horaDe(fin.toISOString())}`;
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{etiqueta}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-slate-800">{children}</dd>
    </div>
  );
}

export function SesionPanel({
  sesion,
  contexto,
  trabajando,
  soloLectura = false,
  onCancelar,
  onCompletar,
  onNoAsistio,
  onReprogramar,
  onGuardarDetalles,
}: {
  sesion: TherapistSessionRow;
  contexto?: ContextoSesion;
  trabajando: boolean;
  /**
   * El paciente ve la misma ficha, pero no la gobierna: puede entrar a la
   * videollamada y leerlo todo, no editar el enlace ni cerrar la sesión. Es la
   * misma ficha a propósito — dos fichas parecidas acaban contando cosas
   * distintas del mismo hecho.
   */
  soloLectura?: boolean;
  onCancelar?: (s: TherapistSessionRow) => void;
  onCompletar?: (s: TherapistSessionRow) => void;
  onNoAsistio?: (s: TherapistSessionRow) => void;
  /** Solo se ofrece cuando detrás hay una cita: es esa cita la que se mueve. */
  onReprogramar?: (s: TherapistSessionRow) => void;
  onGuardarDetalles?: (
    id: string,
    detalles: { videoCallLink?: string | null; notes?: string | null },
  ) => Promise<void> | void;
}) {
  const [editandoEnlace, setEditandoEnlace] = useState(false);
  const [enlaceBorrador, setEnlaceBorrador] = useState(sesion.video_call_link ?? "");
  const [editandoNota, setEditandoNota] = useState(false);
  const [notaBorrador, setNotaBorrador] = useState(sesion.notes ?? "");
  const [copiado, setCopiado] = useState(false);

  const enlace = sesion.video_call_link;
  const viva = sesion.status === "programada" || sesion.status === "confirmada";
  const editable = viva && !soloLectura;
  const paciente = sesion.counterpartName || sesion.patient?.email || "Paciente";

  function copiar() {
    if (!enlace) return;
    void navigator.clipboard?.writeText(enlace);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <article className="rounded-2xl glass-card border border-white/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-base font-bold text-slate-800">{paciente}</p>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-bold ${CLASE_ESTADO[sesion.status]}`}
        >
          {SESSION_STATUS_LABELS[sesion.status]}
        </span>
      </div>

      <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Dato etiqueta="Fecha">
          <span className="capitalize">{fechaLarga(sesion.scheduled_at)}</span>
        </Dato>
        <Dato etiqueta="Hora">{rangoHorario(sesion.scheduled_at, sesion.duration_minutes)}</Dato>
        <Dato etiqueta="Duración">{sesion.duration_minutes} min</Dato>
        <Dato etiqueta="Modalidad">
          {enlace ? (
            <span title="Derivada del enlace de videollamada: no hay modalidad guardada por sesión.">
              Virtual
            </span>
          ) : (
            <span className="font-normal text-muted-foreground">Sin definir</span>
          )}
        </Dato>
      </dl>

      {/* ── Ciclo de vida ── */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white/50 p-3">
        <LineaDeTiempo
          hitos={construirHitos({
            status: sesion.status,
            scheduledAt: sesion.scheduled_at,
            durationMinutes: sesion.duration_minutes,
            videoCallLink: sesion.video_call_link,
            desdeSolicitud: Boolean(sesion.appointment_id),
            desdeContraoferta: contexto?.desdeContraoferta ?? false,
          })}
        />
      </div>

      {/* ── Contexto: de dónde viene y qué hay alrededor ── */}
      {(contexto?.anterior || contexto?.siguiente) && (
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
          {contexto.anterior && (
            <span className="inline-flex items-center gap-1.5">
              <ArrowLeft size={12} /> Anterior con {paciente.split(" ")[0]}:{" "}
              {fechaLarga(contexto.anterior.scheduled_at)}
            </span>
          )}
          {contexto.siguiente && (
            <span className="inline-flex items-center gap-1.5">
              <ArrowRight size={12} /> Siguiente: {fechaLarga(contexto.siguiente.scheduled_at)}
            </span>
          )}
        </div>
      )}

      {/* ── Enlace de la videollamada ── */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-white/50 p-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Videollamada
        </p>

        {editandoEnlace ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type="url"
              autoFocus
              value={enlaceBorrador}
              onChange={(e) => setEnlaceBorrador(e.target.value)}
              placeholder="https://meet.google.com/…"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
            />
            <button
              type="button"
              disabled={trabajando || !enlaceValido(enlaceBorrador)}
              onClick={async () => {
                await onGuardarDetalles?.(sesion.id, { videoCallLink: enlaceBorrador.trim() });
                setEditandoEnlace(false);
              }}
              className="rounded-xl bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={() => {
                setEnlaceBorrador(enlace ?? "");
                setEditandoEnlace(false);
              }}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {enlace ? (
              <>
                <a
                  href={enlace}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary"
                >
                  <Video size={13} /> Abrir videollamada
                </a>
                <button
                  type="button"
                  onClick={copiar}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600"
                >
                  {copiado ? <Check size={13} /> : <Copy size={13} />}
                  {copiado ? "Copiado" : "Copiar enlace"}
                </button>
              </>
            ) : (
              // Nunca un botón que no lleva a ninguna parte: si no hay enlace,
              // se dice que no lo hay.
              viva && (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">
                  <AlertTriangle size={13} />
                  {soloLectura
                    ? "Tu profesional aún no ha puesto el enlace"
                    : "Sin enlace: el paciente no puede entrar"}
                </span>
              )
            )}
            {editable && (
              <button
                type="button"
                onClick={() => setEditandoEnlace(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600"
              >
                <Link2 size={13} /> {enlace ? "Editar enlace" : "Añadir enlace"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Observaciones ── */}
      <div className="mt-3 rounded-xl border border-slate-200 bg-white/50 p-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Observaciones
        </p>
        {editandoNota ? (
          <div className="mt-2 space-y-2">
            <textarea
              rows={3}
              autoFocus
              value={notaBorrador}
              onChange={(e) => setNotaBorrador(e.target.value)}
              className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={trabajando}
                onClick={async () => {
                  await onGuardarDetalles?.(sesion.id, { notes: notaBorrador.trim() || null });
                  setEditandoNota(false);
                }}
                className="rounded-xl bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => {
                  setNotaBorrador(sesion.notes ?? "");
                  setEditandoNota(false);
                }}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-1 flex flex-wrap items-start justify-between gap-2">
            <p className="min-w-0 flex-1 text-sm text-slate-700">
              {sesion.notes || <span className="text-muted-foreground">Sin observaciones.</span>}
            </p>
            {!soloLectura && (
              <button
                type="button"
                onClick={() => setEditandoNota(true)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600"
              >
                <NotebookPen size={13} /> Editar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Los cuatro cierres posibles, juntos y en la misma ficha. "No asistió"
          estaba solo en un desplegable de otra pantalla, y es justo el que hay
          que registrar en caliente. */}
      {editable && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200 pt-3">
          <button
            type="button"
            disabled={trabajando}
            onClick={() => onCompletar?.(sesion)}
            className="rounded-xl bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-60"
          >
            Marcar realizada
          </button>
          {onNoAsistio && (
            <button
              type="button"
              disabled={trabajando}
              onClick={() => onNoAsistio(sesion)}
              className="rounded-xl border border-amber-200 px-4 py-1.5 text-xs font-bold text-amber-700 disabled:opacity-60"
            >
              No asistió
            </button>
          )}
          {onReprogramar && (
            <button
              type="button"
              disabled={trabajando}
              onClick={() => onReprogramar(sesion)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-primary/20 px-4 py-1.5 text-xs font-bold text-primary disabled:opacity-60"
            >
              <CalendarClock size={13} /> Reprogramar
            </button>
          )}
          <button
            type="button"
            disabled={trabajando}
            onClick={() => onCancelar?.(sesion)}
            className="rounded-xl border border-slate-200 px-4 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-60"
          >
            Cancelar sesión
          </button>
        </div>
      )}

      {/* Lo único que se sabe del historial: cuándo se creó y cuándo se tocó por
          última vez. No hay registro de QUÉ cambió ni de quién lo cambió — eso
          exigiría una tabla de auditoría que hoy no existe. */}
      <p className="mt-3 text-[10px] text-slate-400">
        Creada el {fechaLarga(sesion.created_at)}
        {sesion.updated_at !== sesion.created_at && (
          <> · última modificación el {fechaLarga(sesion.updated_at)}</>
        )}
      </p>
    </article>
  );
}
