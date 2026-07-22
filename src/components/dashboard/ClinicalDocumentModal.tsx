// ============================================================================
// Creación / lectura de documentos clínicos, ramificado por document_type.
//
// Un solo modal con tres formularios distintos en vez de tres componentes: el
// encabezado, la firma, la advertencia legal y el bloqueo post-firma son
// idénticos en los tres casos, y duplicarlos era la forma segura de que se
// fueran separando con el tiempo.
//
// La evolución usa a propósito 3 de las 10 categorías de MENTAL_STATUS_OPTIONS:
// registrar una sesión de seguimiento no debe costar el examen mental completo.
// ============================================================================
import { useEffect, useMemo, useState } from "react";
import { Download, FileText, Loader2, Lock, Save, ShieldCheck, X } from "lucide-react";
import {
  DOCUMENT_LABELS,
  saveClinicalDocument,
  searchCie11,
  type ClinicalDocument,
  type DocumentType,
  type TreatmentPlan,
  type Cie11Entry,
} from "../../lib/api";
import { downloadClinicalDocumentPdf } from "../../lib/clinicalPdf";
import type { Profile } from "../../lib/supabase";

// Reutilizadas del examen mental completo. Las 3 más relevantes para una nota
// rápida: cómo llega, si está orientado, y cómo está de ánimo.
const EVOLUCION_OPTIONS = {
  presentacion: ["Adecuada", "Descuido personal", "Extravagante"],
  orientacion: ["Orientado (Global)", "Desorientado en tiempo", "Desorientado en espacio"],
  estado_animo: ["Eutímico", "Deprimido", "Ansioso", "Irritable", "Lábil", "Aplanado"],
};

const ADHERENCIA_OPTIONS = [
  { value: "cumplida", label: "Cumplida" },
  { value: "parcial", label: "Parcial" },
  { value: "no_cumplida", label: "No cumplida" },
] as const;

interface Props {
  documentType: DocumentType;
  existing: ClinicalDocument | null;
  patient: Profile;
  therapist: Profile;
  /** Borrador pre-rellenado para 'informe', armado por la ficha. */
  draft?: Record<string, unknown> | null;
  onClose: () => void;
  onSaved: () => void;
}

const inputClass =
  "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none transition-colors disabled:bg-slate-50 disabled:text-slate-500";

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-900">{label}</label>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      {children}
    </div>
  );
}

export function ClinicalDocumentModal({
  documentType,
  existing,
  patient,
  therapist,
  draft,
  onClose,
  onSaved,
}: Props) {
  const isSigned = existing?.is_signed === true;
  const readOnly = isSigned;

  const initial = useMemo(
    () => (existing?.soap_data as Record<string, unknown>) ?? draft ?? {},
    [existing, draft],
  );

  const [fields, setFields] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(initial)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  });
  const [mentalExam, setMentalExam] = useState<Record<string, string>>(
    () => (initial.mental_exam as Record<string, string>) ?? {},
  );
  const [plan, setPlan] = useState<TreatmentPlan>(
    () =>
      (existing?.treatment_plan as TreatmentPlan) ?? {
        objetivos: ["", "", ""],
        modalidad: "",
        frecuencia_sugerida: "",
        pronostico: "",
      },
  );

  const [cieQuery, setCieQuery] = useState("");
  const [cieResults, setCieResults] = useState<Cie11Entry[]>([]);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Búsqueda CIE-11 con retardo, solo en los tipos que llevan diagnóstico.
  useEffect(() => {
    if (documentType === "evolucion" || cieQuery.trim().length < 3) {
      setCieResults([]);
      return;
    }
    const t = setTimeout(async () => setCieResults(await searchCie11(cieQuery.trim())), 300);
    return () => clearTimeout(t);
  }, [cieQuery, documentType]);

  function setField(key: string, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(sign: boolean) {
    setSaving(true);
    setErrorMsg(null);
    try {
      const soapData: Record<string, unknown> = { ...fields };
      if (documentType === "valoracion") {
        soapData.mental_exam = mentalExam;
        soapData.complaints = (initial.complaints as string[]) ?? [];
      }
      if (documentType === "informe") {
        soapData.evaluaciones_referenciadas =
          (initial.evaluaciones_referenciadas as string[]) ?? [];
      }

      await saveClinicalDocument({
        documentId: existing?.id ?? null,
        patientId: patient.id,
        therapistId: therapist.id,
        documentType,
        soapData,
        treatmentPlan:
          documentType === "valoracion"
            ? { ...plan, objetivos: plan.objetivos.filter((o) => o.trim()) }
            : null,
        sessionId: existing?.session_id ?? null,
        sign,
      });
      onSaved();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "No pudimos guardar el documento.");
      setSaving(false);
    }
  }

  async function handleDownload() {
    if (!existing) return;
    try {
      await downloadClinicalDocumentPdf({ doc: existing, patient, therapist });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "No pudimos generar el PDF.");
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Cabecera */}
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                {DOCUMENT_LABELS[documentType]}
                {isSigned && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    <Lock size={10} /> Firmado
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500">{patient.full_name || patient.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isSigned && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <Download size={14} /> Descargar PDF
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {errorMsg && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600"
            >
              {errorMsg}
            </p>
          )}

          {isSigned && (
            <p className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-relaxed text-emerald-800">
              <ShieldCheck size={14} className="mt-0.5 shrink-0" />
              Documento firmado electrónicamente el{" "}
              {new Date(existing!.signed_at ?? existing!.created_at).toLocaleString("es-CO", {
                dateStyle: "long",
                timeStyle: "short",
              })}
              . Su contenido es inmutable conforme a la Resolución 839 de 2017.
            </p>
          )}

          {/* Diagnóstico: valoración e informe */}
          {documentType !== "evolucion" && (
            <Field label="Diagnóstico (CIE-11)">
              <input
                className={inputClass}
                disabled={readOnly}
                value={fields.diagnostic ?? ""}
                onChange={(e) => setField("diagnostic", e.target.value)}
                placeholder="Selecciona un código de la búsqueda o escríbelo"
              />
              {!readOnly && (
                <>
                  <input
                    className={`${inputClass} mt-2`}
                    value={cieQuery}
                    onChange={(e) => setCieQuery(e.target.value)}
                    placeholder="Buscar en el catálogo CIE-11 (mín. 3 letras)…"
                  />
                  {cieResults.length > 0 && (
                    <ul className="mt-1 max-h-40 overflow-y-auto rounded-xl border border-slate-200">
                      {cieResults.map((r) => (
                        <li key={r.code}>
                          <button
                            type="button"
                            onClick={() => {
                              setField("diagnostic", `${r.code} - ${r.description}`);
                              setCieQuery("");
                              setCieResults([]);
                            }}
                            className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50"
                          >
                            <span className="font-bold text-primary">{r.code}</span> —{" "}
                            {r.description}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </Field>
          )}

          {/* ── Valoración ── */}
          {documentType === "valoracion" && (
            <>
              {(
                [
                  ["s", "Subjetivo", "Motivo de consulta y relato del paciente."],
                  ["o", "Objetivo", "Lo observado durante la entrevista."],
                  ["a", "Análisis", "Interpretación clínica."],
                  ["p", "Plan", "Conducta a seguir."],
                ] as const
              ).map(([key, label, hint]) => (
                <Field key={key} label={label} hint={hint}>
                  <textarea
                    rows={3}
                    disabled={readOnly}
                    className={inputClass}
                    value={fields[key] ?? ""}
                    onChange={(e) => setField(key, e.target.value)}
                  />
                </Field>
              ))}

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-900">Examen mental</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {Object.entries(EVOLUCION_OPTIONS).map(([key, options]) => (
                    <div key={key}>
                      <label className="text-xs font-semibold capitalize text-slate-700">
                        {key.replace("_", " ")}
                      </label>
                      <select
                        disabled={readOnly}
                        className={inputClass}
                        value={mentalExam[key] ?? ""}
                        onChange={(e) => setMentalExam({ ...mentalExam, [key]: e.target.value })}
                      >
                        <option value="">Seleccionar…</option>
                        {options.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4">
                <p className="text-sm font-bold text-slate-900">Plan de tratamiento</p>
                <p className="text-xs text-slate-500">
                  Objetivos, modalidad, frecuencia y pronóstico del proceso.
                </p>
                <div className="mt-3 space-y-3">
                  {plan.objetivos.map((obj, i) => (
                    <input
                      key={i}
                      disabled={readOnly}
                      className={inputClass}
                      value={obj}
                      placeholder={`Objetivo ${i + 1}`}
                      onChange={(e) => {
                        const next = [...plan.objetivos];
                        next[i] = e.target.value;
                        setPlan({ ...plan, objetivos: next });
                      }}
                    />
                  ))}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      disabled={readOnly}
                      className={inputClass}
                      value={plan.modalidad}
                      placeholder="Modalidad (ej. TCC individual)"
                      onChange={(e) => setPlan({ ...plan, modalidad: e.target.value })}
                    />
                    <input
                      disabled={readOnly}
                      className={inputClass}
                      value={plan.frecuencia_sugerida}
                      placeholder="Frecuencia (ej. Semanal)"
                      onChange={(e) => setPlan({ ...plan, frecuencia_sugerida: e.target.value })}
                    />
                  </div>
                  <input
                    disabled={readOnly}
                    className={inputClass}
                    value={plan.pronostico}
                    placeholder="Pronóstico"
                    onChange={(e) => setPlan({ ...plan, pronostico: e.target.value })}
                  />
                </div>
              </div>
            </>
          )}

          {/* ── Evolución ── */}
          {documentType === "evolucion" && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                {Object.entries(EVOLUCION_OPTIONS).map(([key, options]) => (
                  <div key={key}>
                    <label className="text-xs font-semibold capitalize text-slate-700">
                      {key.replace("_", " ")}
                    </label>
                    <select
                      disabled={readOnly}
                      className={inputClass}
                      value={fields[key] ?? ""}
                      onChange={(e) => setField(key, e.target.value)}
                    >
                      <option value="">Seleccionar…</option>
                      {options.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <Field label="Adherencia a las tareas asignadas">
                <select
                  disabled={readOnly}
                  className={inputClass}
                  value={fields.adherencia_tareas ?? ""}
                  onChange={(e) => setField("adherencia_tareas", e.target.value)}
                >
                  <option value="">Sin registrar</option>
                  {ADHERENCIA_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Resumen de la sesión">
                <textarea
                  rows={4}
                  disabled={readOnly}
                  className={inputClass}
                  value={fields.resumen ?? ""}
                  onChange={(e) => setField("resumen", e.target.value)}
                />
              </Field>

              <Field label="Plan para la próxima sesión">
                <textarea
                  rows={2}
                  disabled={readOnly}
                  className={inputClass}
                  value={fields.plan_proxima_sesion ?? ""}
                  onChange={(e) => setField("plan_proxima_sesion", e.target.value)}
                />
              </Field>
            </>
          )}

          {/* ── Informe ── */}
          {documentType === "informe" && (
            <>
              {(
                [
                  [
                    "resumen_valoracion",
                    "Resumen de la valoración",
                    "Pre-rellenado desde la última valoración firmada. Editable.",
                  ],
                  [
                    "resumen_evolucion",
                    "Resumen de la evolución",
                    "Pre-rellenado desde las evoluciones firmadas. Editable.",
                  ],
                  ["conclusiones", "Conclusiones", ""],
                  ["recomendaciones", "Recomendaciones", ""],
                ] as const
              ).map(([key, label, hint]) => (
                <Field key={key} label={label} hint={hint || undefined}>
                  <textarea
                    rows={4}
                    disabled={readOnly}
                    className={inputClass}
                    value={fields[key] ?? ""}
                    onChange={(e) => setField(key, e.target.value)}
                  />
                </Field>
              ))}
            </>
          )}
        </div>

        {/* Pie */}
        {!readOnly && (
          <div className="border-t border-slate-100 px-6 py-4">
            <p className="mb-3 text-xs leading-relaxed text-slate-500">
              Al firmar, el documento queda inmutable conforme a la Resolución 839 de 2017. No podrá
              editarse después; una corrección requiere un documento nuevo.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
              >
                <Save size={15} /> Guardar borrador
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                Firmar y guardar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
