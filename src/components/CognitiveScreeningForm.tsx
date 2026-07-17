import { useState } from "react";
import { Brain, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";

interface PatientOption {
  id: string;
  name: string;
}

interface Props {
  therapistId: string;
  patients: PatientOption[];
}

// MoCA y MMSE se administran presencialmente por el clínico (entrevista estructurada con tareas de
// dibujo/copia de figuras) — a diferencia de PHQ-9/GAD-7/C-SSRS, no son autoadministrables por el
// paciente. Esta es una herramienta de registro post-aplicación, no un cuestionario interactivo.
// Puntos de corte de referencia (05_Escalas_Evaluacion...): MoCA <26/30 sugiere deterioro,
// MMSE <24/30 sugiere deterioro (con matices por edad/escolaridad, criterio clínico del terapeuta).
type ScaleType = "moca" | "mmse";

function severityFromScore(scale: ScaleType, score: number): string {
  const threshold = scale === "moca" ? 26 : 24;
  if (score >= threshold) return "Sin sospecha de deterioro";
  if (score >= threshold - 4) return "Deterioro leve sugerido";
  return "Deterioro significativo sugerido";
}

export function CognitiveScreeningForm({ therapistId, patients }: Props) {
  const [patientId, setPatientId] = useState("");
  const [scaleType, setScaleType] = useState<ScaleType>("moca");
  const [totalScore, setTotalScore] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccessMsg("");
    setErrorMsg("");

    const score = Number(totalScore);
    if (!patientId || totalScore === "" || Number.isNaN(score) || score < 0 || score > 30) {
      setErrorMsg("Selecciona un paciente e ingresa un puntaje válido entre 0 y 30.");
      return;
    }

    setSubmitting(true);
    const severity = severityFromScore(scaleType, score);

    const { error } = await supabase.from("psychometric_evaluations").insert({
      patient_id: patientId,
      therapist_id: therapistId,
      scale_type: scaleType,
      total_score: score,
      severity_level: severity,
      raw_answers: notes.trim() ? { notas: notes.trim() } : null,
    });

    setSubmitting(false);

    if (error) {
      console.error("[CognitiveScreeningForm] Error:", error);
      setErrorMsg("Hubo un error al registrar la evaluación.");
    } else {
      setSuccessMsg(`Registrado: ${scaleType.toUpperCase()} ${score}/30 · ${severity}`);
      setTotalScore("");
      setNotes("");
      setTimeout(() => setSuccessMsg(""), 4000);
    }
  }

  return (
    <div className="card-neon-hover rounded-3xl glass-card p-6 border border-white/40">
      <h2 className="text-lg font-bold text-primary mb-1 flex items-center gap-2">
        <Brain size={20} /> Registrar evaluación cognitiva (MoCA / MMSE)
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Para usar después de aplicar la escala presencialmente con el paciente. Se guarda el puntaje
        total y queda asociado a la fecha para seguimiento longitudinal.
      </p>

      {successMsg && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm text-center font-medium">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm text-center font-medium">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-semibold text-primary">Paciente</label>
          <select
            required
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/50 bg-white/50 backdrop-blur px-3 py-3 text-sm focus:border-primary focus:outline-none shadow-sm"
          >
            <option value="">-- Selecciona un paciente --</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-semibold text-primary">Escala aplicada</label>
          <select
            value={scaleType}
            onChange={(e) => setScaleType(e.target.value as ScaleType)}
            className="mt-1 w-full rounded-xl border border-white/50 bg-white/50 backdrop-blur px-3 py-3 text-sm focus:border-primary focus:outline-none shadow-sm"
          >
            <option value="moca">MoCA (Montreal Cognitive Assessment)</option>
            <option value="mmse">MMSE (Mini-Mental State Examination)</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-semibold text-primary">Puntaje total (0-30)</label>
          <input
            type="number"
            min={0}
            max={30}
            required
            value={totalScore}
            onChange={(e) => setTotalScore(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/50 bg-white/50 backdrop-blur px-3 py-3 text-sm focus:border-primary focus:outline-none shadow-sm"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-primary">Notas (opcional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observaciones de la aplicación"
            className="mt-1 w-full rounded-xl border border-white/50 bg-white/50 backdrop-blur px-3 py-3 text-sm focus:border-primary focus:outline-none shadow-sm"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || patients.length === 0}
          className="sm:col-span-2 mt-2 w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-transform hover:scale-[1.01] shadow-lg shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Guardando...
            </>
          ) : (
            "Registrar evaluación"
          )}
        </button>
      </form>
    </div>
  );
}
