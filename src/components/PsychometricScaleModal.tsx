import { useState } from "react";
import { X, Loader2, ClipboardCheck, AlertTriangle } from "lucide-react";
import { supabase } from "../lib/supabase";
import { SCALES, type ScaleDefinition } from "../lib/psychometricScales";

interface Props {
  scaleType: "phq9" | "gad7";
  patientId: string;
  onClose: () => void;
  onSaved?: (result: { totalScore: number; severity: string }) => void;
}

export function PsychometricScaleModal({ scaleType, patientId, onClose, onSaved }: Props) {
  const scale: ScaleDefinition = SCALES[scaleType];
  const [answers, setAnswers] = useState<(number | null)[]>(scale.items.map(() => null));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<{ totalScore: number; severity: string; risk: boolean } | null>(
    null,
  );

  const allAnswered = answers.every((a) => a !== null);

  function setAnswer(index: number, value: number) {
    setAnswers((prev) => prev.map((a, i) => (i === index ? value : a)));
  }

  async function handleSubmit() {
    if (!allAnswered) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    const totalScore = (answers as number[]).reduce((sum, v) => sum + v, 0);
    const severity = scale.severity(totalScore);
    const risk =
      scale.riskItemIndex !== undefined ? (answers[scale.riskItemIndex] as number) > 0 : false;

    try {
      // Buscar terapeuta asignado (puede no haber ninguno todavía)
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
          scale_type: scale.key,
          total_score: totalScore,
          severity_level: severity.label,
          raw_answers: answers,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      if (risk) {
        const { error: alertError } = await supabase.from("clinical_alerts").insert({
          patient_id: patientId,
          test_score_id: inserted?.id ?? null,
          status: "high_priority",
        });
        if (alertError) console.error("[PsychometricScaleModal] Error creando alerta:", alertError);
      }

      setResult({ totalScore, severity: severity.label, risk });
      onSaved?.({ totalScore, severity: severity.label });
    } catch (err) {
      console.error("[PsychometricScaleModal] Error al guardar evaluación:", err);
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ClipboardCheck size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{scale.title}</h2>
              <p className="text-xs text-slate-500">{scale.subtitle}</p>
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
              <p className="text-sm text-slate-500 mb-1">Puntaje total</p>
              <p className="text-5xl font-bold text-primary mb-2">{result.totalScore}</p>
              <p className="text-lg font-semibold text-slate-800 mb-6">Severidad: {result.severity}</p>

              {result.risk && (
                <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-left flex gap-3">
                  <AlertTriangle size={20} className="text-red-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">
                    Tu respuesta indica que puede haber riesgo para tu seguridad. Ya enviamos una alerta
                    directa a tu terapeuta asignado, quien se pondrá en contacto contigo lo antes
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
            <>
              <p className="mb-5 text-sm font-medium text-slate-600">{scale.instructions}</p>
              <div className="space-y-5">
                {scale.items.map((item, index) => (
                  <div key={index} className="rounded-xl border border-slate-200 p-4">
                    <p className="mb-3 text-sm font-semibold text-slate-800">
                      {index + 1}. {item}
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {scale.options.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setAnswer(index, option.value)}
                          className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                            answers[index] === option.value
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-slate-200 text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
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
