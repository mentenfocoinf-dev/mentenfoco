import { useState } from "react";
import { X, Loader2, ShieldAlert, AlertTriangle } from "lucide-react";
import { supabase } from "../lib/supabase";

interface Props {
  patientId: string;
  onClose: () => void;
  onSaved?: (result: { riskLevel: string }) => void;
}

// Versión de cribado del Columbia-Suicide Severity Rating Scale (C-SSRS). No es un puntaje sumado:
// es una clasificación por nivel de riesgo. Preguntas 3-5 (método, intención, plan) solo se preguntan
// si la respuesta a la pregunta 2 (ideación activa) es afirmativa — es la lógica de ramificación que
// la investigación (05_Escalas...) marca como el motivo de la mayor complejidad de esta escala.
type YesNo = "yes" | "no";

interface Answers {
  q1_pasiva: YesNo | null;
  q2_activa: YesNo | null;
  q3_metodo: YesNo | null;
  q4_intencion: YesNo | null;
  q5_plan: YesNo | null;
  q6_comportamiento: YesNo | null;
}

const initialAnswers: Answers = {
  q1_pasiva: null,
  q2_activa: null,
  q3_metodo: null,
  q4_intencion: null,
  q5_plan: null,
  q6_comportamiento: null,
};

function calcularRiesgo(a: Answers): { level: "ninguno" | "bajo" | "moderado" | "alto"; label: string } {
  if (a.q4_intencion === "yes" || a.q5_plan === "yes" || a.q6_comportamiento === "yes") {
    return { level: "alto", label: "Alto" };
  }
  if (a.q2_activa === "yes" && a.q3_metodo === "yes") {
    return { level: "moderado", label: "Moderado" };
  }
  if (a.q1_pasiva === "yes" || a.q2_activa === "yes") {
    return { level: "bajo", label: "Bajo" };
  }
  return { level: "ninguno", label: "Ninguno" };
}

function YesNoButtons({
  value,
  onChange,
}: {
  value: YesNo | null;
  onChange: (v: YesNo) => void;
}) {
  return (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={() => onChange("no")}
        className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
          value === "no"
            ? "border-primary bg-primary/10 text-primary"
            : "border-slate-200 text-slate-600 hover:border-slate-300"
        }`}
      >
        No
      </button>
      <button
        type="button"
        onClick={() => onChange("yes")}
        className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
          value === "yes"
            ? "border-red-400 bg-red-50 text-red-700"
            : "border-slate-200 text-slate-600 hover:border-slate-300"
        }`}
      >
        Sí
      </button>
    </div>
  );
}

export function CssrsModal({ patientId, onClose, onSaved }: Props) {
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<{ label: string; level: string } | null>(null);

  const needsBranch = answers.q2_activa === "yes";
  const branchAnswered =
    !needsBranch ||
    (answers.q3_metodo !== null && answers.q4_intencion !== null && answers.q5_plan !== null);
  const allAnswered =
    answers.q1_pasiva !== null &&
    answers.q2_activa !== null &&
    answers.q6_comportamiento !== null &&
    branchAnswered;

  function set(field: keyof Answers, value: YesNo) {
    setAnswers((prev) => {
      const next = { ...prev, [field]: value };
      // Si la ideación activa pasa a "no", limpiamos las ramificadas para no dejar respuestas huérfanas
      if (field === "q2_activa" && value === "no") {
        next.q3_metodo = null;
        next.q4_intencion = null;
        next.q5_plan = null;
      }
      return next;
    });
  }

  async function handleSubmit() {
    if (!allAnswered) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    const riesgo = calcularRiesgo(answers);
    const totalScore = Object.values(answers).filter((v) => v === "yes").length;

    try {
      const { data: assignment } = await supabase
        .from("patient_therapist")
        .select("therapist_id")
        .eq("patient_id", patientId)
        .maybeSingle();

      const { data: inserted, error: insertError } = await supabase
        .from("psychometric_evaluations")
        .insert({
          patient_id: patientId,
          therapist_id: assignment?.therapist_id ?? null,
          scale_type: "cssrs",
          total_score: totalScore,
          severity_level: riesgo.label,
          raw_answers: answers,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      if (riesgo.level === "moderado" || riesgo.level === "alto") {
        const { error: alertError } = await supabase.from("clinical_alerts").insert({
          patient_id: patientId,
          test_score_id: inserted?.id ?? null,
          status: "high_priority",
        });
        if (alertError) console.error("[CssrsModal] Error creando alerta:", alertError);
      }

      setResult(riesgo);
      onSaved?.({ riskLevel: riesgo.label });
    } catch (err) {
      console.error("[CssrsModal] Error al guardar evaluación:", err);
      setErrorMsg("No se pudo guardar la evaluación. Intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex max-h-[90vh] w-full max-w-xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">C-SSRS</h2>
              <p className="text-xs text-slate-500">Cribado de ideación y comportamiento suicida</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {result ? (
            <div className="text-center py-4">
              <p className="text-sm text-slate-500 mb-1">Nivel de riesgo</p>
              <p className="text-4xl font-bold text-primary mb-6">{result.label}</p>

              {(result.level === "moderado" || result.level === "alto") && (
                <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-left flex gap-3">
                  <AlertTriangle size={20} className="text-red-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">
                    Tus respuestas indican que puede haber riesgo para tu seguridad. Ya enviamos una
                    alerta directa a tu terapeuta asignado, quien se pondrá en contacto contigo lo antes
                    posible. Si en este momento estás en peligro, acude al servicio de urgencias más
                    cercano.
                  </p>
                </div>
              )}

              <p className="text-sm text-slate-500 mb-6">
                Esta evaluación quedó registrada y tu terapeuta podrá verla en tu próxima sesión.
              </p>
              <button
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-xl bg-primary px-8 py-3 text-sm font-bold text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
              >
                Cerrar
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <p className="text-sm font-medium text-slate-600">
                Estas preguntas son de rutina y ayudan a tu equipo clínico a cuidarte mejor. Responde
                con honestidad — no hay respuesta "correcta".
              </p>

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="mb-3 text-sm font-semibold text-slate-800">
                  1. ¿Has deseado estar muerto/a o deseado quedarte dormido/a y no despertar?
                </p>
                <YesNoButtons value={answers.q1_pasiva} onChange={(v) => set("q1_pasiva", v)} />
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="mb-3 text-sm font-semibold text-slate-800">
                  2. ¿Has tenido pensamientos reales de hacerte daño o quitarte la vida?
                </p>
                <YesNoButtons value={answers.q2_activa} onChange={(v) => set("q2_activa", v)} />
              </div>

              {needsBranch && (
                <>
                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                    <p className="mb-3 text-sm font-semibold text-slate-800">
                      3. ¿Has pensado en cómo podrías hacerlo?
                    </p>
                    <YesNoButtons value={answers.q3_metodo} onChange={(v) => set("q3_metodo", v)} />
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                    <p className="mb-3 text-sm font-semibold text-slate-800">
                      4. ¿Has tenido esos pensamientos con alguna intención de llevarlos a cabo?
                    </p>
                    <YesNoButtons
                      value={answers.q4_intencion}
                      onChange={(v) => set("q4_intencion", v)}
                    />
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                    <p className="mb-3 text-sm font-semibold text-slate-800">
                      5. ¿Has empezado a planear los detalles de cómo hacerlo, con intención de
                      llevarlo a cabo?
                    </p>
                    <YesNoButtons value={answers.q5_plan} onChange={(v) => set("q5_plan", v)} />
                  </div>
                </>
              )}

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="mb-3 text-sm font-semibold text-slate-800">
                  6. ¿Alguna vez hiciste algo, empezaste a hacer algo, o te preparaste para hacer algo
                  para terminar con tu vida?
                </p>
                <YesNoButtons
                  value={answers.q6_comportamiento}
                  onChange={(v) => set("q6_comportamiento", v)}
                />
              </div>
            </div>
          )}
        </div>

        {!result && (
          <div className="border-t border-slate-100 p-6">
            {errorMsg && <p className="mb-3 text-sm text-red-600 text-center">{errorMsg}</p>}
            <button
              onClick={handleSubmit}
              disabled={!allAnswered || isSubmitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-sm font-bold text-primary-foreground shadow-lg transition-transform hover:-translate-y-0.5 hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Guardando...
                </>
              ) : (
                "Enviar evaluación"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
