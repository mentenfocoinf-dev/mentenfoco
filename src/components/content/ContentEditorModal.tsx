// ============================================================================
// Editor de una pieza de contenido, compartido por el terapeuta y el admin.
//
// El componente solo edita y guarda; las acciones de flujo (enviar a revisión,
// aprobar, publicar) las decide quien lo usa, porque dependen del rol. El admin
// recibe `canPublish` y con eso aparecen sus acciones extra — pero la barrera
// real no es este prop: es el trigger de la base, que rechaza una publicación
// hecha por alguien que no sea admin.
// ============================================================================
import { useState } from "react";
import { Loader2, Save, Send, X } from "lucide-react";
import {
  createContentDraft,
  updateContentDraft,
  slugify,
  CONTENT_TYPE_LABELS,
  type ContentItem,
  type ContentType,
  type AudioKind,
} from "../../lib/api";
import type { PlanType } from "../../lib/supabase";

/** Taxonomía compartida con las guías. */
export const CONTENT_CATEGORIES = [
  "Alimentación",
  "Ánimo",
  "Ansiedad",
  "Autoestima",
  "Infantil",
  "Memoria",
  "Relaciones",
  "Trauma",
  "Sueño",
  "Personalidad",
  "Estrés laboral",
  "Adicciones",
  "Salud mental perinatal",
];

interface Props {
  authorId: string;
  existing: ContentItem | null;
  /** Solo lectura cuando el autor ya no puede editar (en revisión, publicado…). */
  readOnly?: boolean;
  onClose: () => void;
  onSaved: (id: string) => void;
  /** Acciones extra que el contenedor inyecta según el rol (publicar, aprobar…). */
  footerExtra?: React.ReactNode;
  /** Si el autor puede enviar a revisión desde aquí. */
  onSubmitForReview?: (id: string) => Promise<void>;
}

const inputClass =
  "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none transition-colors disabled:bg-slate-50 disabled:text-slate-500";

export function ContentEditorModal({
  authorId,
  existing,
  readOnly = false,
  onClose,
  onSaved,
  footerExtra,
  onSubmitForReview,
}: Props) {
  const [contentType, setContentType] = useState<ContentType>(
    existing?.content_type ?? "articulo",
  );
  const [audioKind, setAudioKind] = useState<AudioKind | "">(existing?.audio_kind ?? "");
  const [categoria, setCategoria] = useState(existing?.categoria ?? CONTENT_CATEGORIES[2]);
  const [titulo, setTitulo] = useState(existing?.titulo ?? "");
  const [slug, setSlug] = useState(existing?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(existing?.slug));
  const [resumen, setResumen] = useState(existing?.resumen_breve ?? "");
  const [tiempo, setTiempo] = useState(existing?.tiempo_lectura ?? "");
  const [minPlan, setMinPlan] = useState<PlanType>(existing?.min_plan ?? "free");
  const [bodyMd, setBodyMd] = useState(existing?.body_md ?? "");

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const complete = titulo.trim() && resumen.trim() && categoria && (slugTouched ? slug.trim() : true);

  function handleTitulo(value: string) {
    setTitulo(value);
    // El slug sigue al título hasta que alguien lo edite a mano.
    if (!slugTouched) setSlug(slugify(value));
  }

  async function save(): Promise<string | null> {
    setSaving(true);
    setErrorMsg(null);
    setOkMsg(null);
    try {
      const payload = {
        content_type: contentType,
        audio_kind: contentType === "audio" && audioKind ? (audioKind as AudioKind) : null,
        categoria,
        titulo: titulo.trim(),
        slug: (slug || slugify(titulo)).trim(),
        resumen_breve: resumen.trim(),
        tiempo_lectura: tiempo.trim() || null,
        min_plan: minPlan,
        body_md: bodyMd || null,
      };

      let id = existing?.id ?? null;
      if (id) {
        await updateContentDraft(id, payload);
      } else {
        id = await createContentDraft(authorId, payload);
      }
      setOkMsg("Guardado.");
      onSaved(id);
      return id;
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "No pudimos guardar la pieza.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function saveAndSubmit() {
    const id = await save();
    if (!id || !onSubmitForReview) return;
    setSaving(true);
    try {
      await onSubmitForReview(id);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "No pudimos enviar a revisión.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {existing ? "Editar contenido" : "Nueva propuesta de contenido"}
            </h2>
            <p className="text-xs text-slate-500">
              {readOnly
                ? "Vista de solo lectura."
                : "Guarda como borrador cuantas veces quieras antes de enviarlo."}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {errorMsg && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
              {errorMsg}
            </p>
          )}
          {okMsg && (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
              {okMsg}
            </p>
          )}
          {existing?.review_notes && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-orange-700">
                Cambios solicitados por el equipo
              </p>
              <p className="mt-1 text-sm text-orange-800">{existing.review_notes}</p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-900">Tipo</label>
              <select
                disabled={readOnly}
                value={contentType}
                onChange={(e) => setContentType(e.target.value as ContentType)}
                className={inputClass}
              >
                {(Object.keys(CONTENT_TYPE_LABELS) as ContentType[]).map((t) => (
                  <option key={t} value={t}>
                    {CONTENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-900">Categoría</label>
              <select
                disabled={readOnly}
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className={inputClass}
              >
                {CONTENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {contentType === "audio" && (
            <div>
              <label className="text-sm font-semibold text-slate-900">Tipo de audio</label>
              <select
                disabled={readOnly}
                value={audioKind}
                onChange={(e) => setAudioKind(e.target.value as AudioKind | "")}
                className={inputClass}
              >
                <option value="">Sin especificar</option>
                <option value="meditacion">Meditación</option>
                <option value="podcast">Podcast</option>
              </select>
              <p className="mt-1 text-xs text-slate-500">
                La grabación se agrega después; el resumen del tema ya se puede publicar.
              </p>
            </div>
          )}

          <div>
            <label className="text-sm font-semibold text-slate-900">Título</label>
            <input
              disabled={readOnly}
              value={titulo}
              onChange={(e) => handleTitulo(e.target.value)}
              placeholder="Ej. La ansiedad que no se apaga"
              className={inputClass}
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-900">
              URL (slug) <span className="font-normal text-slate-500">— se genera del título</span>
            </label>
            <input
              disabled={readOnly}
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
              placeholder="la-ansiedad-que-no-se-apaga"
              className={inputClass}
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-900">Resumen breve</label>
            <textarea
              disabled={readOnly}
              rows={2}
              value={resumen}
              onChange={(e) => setResumen(e.target.value)}
              placeholder="Una frase: lo que el lector se lleva."
              className={inputClass}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-900">
                Tiempo de lectura / duración
              </label>
              <input
                disabled={readOnly}
                value={tiempo}
                onChange={(e) => setTiempo(e.target.value)}
                placeholder="8 min"
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-900">Plan mínimo</label>
              <select
                disabled={readOnly}
                value={minPlan}
                onChange={(e) => setMinPlan(e.target.value as PlanType)}
                className={inputClass}
              >
                <option value="free">Libre (todos)</option>
                <option value="esencial">Requiere plan pago</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-900">
              Contenido <span className="font-normal text-slate-500">(markdown)</span>
            </label>
            <textarea
              disabled={readOnly}
              rows={14}
              value={bodyMd}
              onChange={(e) => setBodyMd(e.target.value)}
              placeholder={"## Sección\n\nEscribe aquí el contenido…"}
              className={`${inputClass} font-mono text-xs leading-relaxed`}
            />
            <p className="mt-1 text-xs text-slate-500">
              Sigue la guía de estilo: gancho de apertura, secciones con "qué ganas", cierre
              esperanzador. Se renderiza igual que las guías.
            </p>
          </div>
        </div>

        {!readOnly && (
          <div className="border-t border-slate-100 px-6 py-4">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => void save()}
                disabled={!complete || saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                Guardar borrador
              </button>
              {onSubmitForReview && (
                <button
                  onClick={() => void saveAndSubmit()}
                  disabled={!complete || saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90 disabled:opacity-60"
                >
                  <Send size={15} /> Enviar a revisión
                </button>
              )}
              {footerExtra}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
