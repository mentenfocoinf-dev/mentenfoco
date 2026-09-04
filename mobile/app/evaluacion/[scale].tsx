import { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useAuth } from "../../src/hooks/useAuth";
import { SCALES } from "../../src/lib/psychometricScales";
import { submitEvaluation, createCrisisAlert } from "../../src/lib/api/clinicalService";
import { colors } from "../../src/theme/colors";

// Botón Sí/No reutilizado en C-SSRS.
function YesNoButtons({
  value,
  onChange,
}: {
  value: "yes" | "no" | null;
  onChange: (v: "yes" | "no") => void;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      {(["no", "yes"] as const).map((opt) => (
        <Pressable
          key={opt}
          onPress={() => onChange(opt)}
          style={[
            styles.yesNoButton,
            value === opt && (opt === "yes" ? styles.yesActive : styles.noActive),
          ]}
        >
          <Text
            style={[
              styles.yesNoText,
              value === opt && (opt === "yes" ? styles.yesActiveText : styles.noActiveText),
            ]}
          >
            {opt === "yes" ? "Sí" : "No"}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function EvaluacionScreen() {
  const { scale } = useLocalSearchParams<{ scale: string }>();
  const { profile } = useAuth();
  const router = useRouter();

  if (scale === "cssrs")
    return <CssrsScreen patientId={profile?.id} onDone={() => router.back()} />;
  return (
    <FrequencyScaleScreen
      scaleKey={scale as "phq9" | "gad7"}
      patientId={profile?.id}
      onDone={() => router.back()}
    />
  );
}

// ── PHQ-9 / GAD-7 (genérico, contenido literal en src/lib/psychometricScales.ts) ────────────────
function FrequencyScaleScreen({
  scaleKey,
  patientId,
  onDone,
}: {
  scaleKey: "phq9" | "gad7";
  patientId?: string;
  onDone: () => void;
}) {
  const scaleDef = SCALES[scaleKey];
  const [answers, setAnswers] = useState<(number | null)[]>(
    Array(scaleDef.items.length).fill(null),
  );
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; label: string } | null>(null);
  const allAnswered = answers.every((a) => a !== null);

  async function handleSubmit() {
    if (!allAnswered || !patientId) return;
    setSubmitting(true);
    const total = answers.reduce((sum, a) => sum + (a ?? 0), 0);
    const severity = scaleDef.severity(total);
    try {
      await submitEvaluation({
        patientId,
        scaleType: scaleDef.key,
        totalScore: total,
        severityLevel: severity.label,
        rawAnswers: { respuestas: answers },
      });
      // Ítem de riesgo (ideación, PHQ-9 pregunta 9): si hay respuesta > 0, alertamos al terapeuta.
      if (scaleDef.riskItemIndex != null && (answers[scaleDef.riskItemIndex] ?? 0) > 0) {
        await createCrisisAlert(patientId);
      }
      setResult({ score: total, label: severity.label });
    } catch (err) {
      console.error("[Evaluacion] Error guardando:", err);
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <ResultScreen
        title={scaleDef.title}
        scoreLine={`${result.score} pts · ${result.label}`}
        showCrisisNotice={
          scaleDef.riskItemIndex != null && (answers[scaleDef.riskItemIndex] ?? 0) > 0
        }
        onDone={onDone}
      />
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: scaleDef.title }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 100 }}
      >
        <Text style={styles.instructions}>{scaleDef.instructions}</Text>
        {scaleDef.items.map((item, i) => (
          <View key={i} style={styles.questionCard}>
            <Text style={styles.questionText}>
              {i + 1}. {item}
            </Text>
            <View style={{ gap: 6, marginTop: 8 }}>
              {scaleDef.options.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() =>
                    setAnswers((prev) => {
                      const next = [...prev];
                      next[i] = opt.value;
                      return next;
                    })
                  }
                  style={[styles.optionRow, answers[i] === opt.value && styles.optionRowActive]}
                >
                  <Text
                    style={[styles.optionText, answers[i] === opt.value && styles.optionTextActive]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          style={[styles.submitButton, (!allAnswered || submitting) && { opacity: 0.5 }]}
          disabled={!allAnswered || submitting}
          onPress={handleSubmit}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Enviar evaluación</Text>
          )}
        </Pressable>
      </View>
    </>
  );
}

// ── C-SSRS (contenido literal, portado de src/components/CssrsModal.tsx) ────────────────────────
type YesNo = "yes" | "no";
// `type` y no `interface`: una interface no tiene index signature implícita, así que no es
// asignable a Record<string, unknown> (el tipo de rawAnswers en clinicalService).
type CssrsAnswers = {
  q1_pasiva: YesNo | null;
  q2_activa: YesNo | null;
  q3_metodo: YesNo | null;
  q4_intencion: YesNo | null;
  q5_plan: YesNo | null;
  q6_comportamiento: YesNo | null;
};
const initialCssrs: CssrsAnswers = {
  q1_pasiva: null,
  q2_activa: null,
  q3_metodo: null,
  q4_intencion: null,
  q5_plan: null,
  q6_comportamiento: null,
};

function calcularRiesgo(a: CssrsAnswers) {
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

function CssrsScreen({ patientId, onDone }: { patientId?: string; onDone: () => void }) {
  const [answers, setAnswers] = useState<CssrsAnswers>(initialCssrs);
  const [submitting, setSubmitting] = useState(false);
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

  function set(field: keyof CssrsAnswers, value: YesNo) {
    setAnswers((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "q2_activa" && value === "no") {
        next.q3_metodo = null;
        next.q4_intencion = null;
        next.q5_plan = null;
      }
      return next;
    });
  }

  async function handleSubmit() {
    if (!allAnswered || !patientId) return;
    setSubmitting(true);
    const riesgo = calcularRiesgo(answers);
    const totalScore = Object.values(answers).filter((v) => v === "yes").length;
    try {
      await submitEvaluation({
        patientId,
        scaleType: "cssrs",
        totalScore,
        severityLevel: riesgo.label,
        rawAnswers: answers,
      });
      if (riesgo.level === "moderado" || riesgo.level === "alto") {
        await createCrisisAlert(patientId);
      }
      setResult(riesgo);
    } catch (err) {
      console.error("[CSSRS] Error guardando:", err);
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <ResultScreen
        title="C-SSRS"
        scoreLine={`Nivel de riesgo: ${result.label}`}
        showCrisisNotice={result.level === "moderado" || result.level === "alto"}
        onDone={onDone}
      />
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "C-SSRS" }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 100 }}
      >
        <Text style={styles.instructions}>
          Estas preguntas son de rutina y ayudan a tu equipo clínico a cuidarte mejor. Responde con
          honestidad — no hay respuesta "correcta".
        </Text>

        <View style={styles.questionCard}>
          <Text style={styles.questionText}>
            1. ¿Has deseado estar muerto/a o deseado quedarte dormido/a y no despertar?
          </Text>
          <View style={{ marginTop: 8 }}>
            <YesNoButtons value={answers.q1_pasiva} onChange={(v) => set("q1_pasiva", v)} />
          </View>
        </View>

        <View style={styles.questionCard}>
          <Text style={styles.questionText}>
            2. ¿Has tenido pensamientos reales de hacerte daño o quitarte la vida?
          </Text>
          <View style={{ marginTop: 8 }}>
            <YesNoButtons value={answers.q2_activa} onChange={(v) => set("q2_activa", v)} />
          </View>
        </View>

        {needsBranch && (
          <>
            <View style={[styles.questionCard, styles.branchCard]}>
              <Text style={styles.questionText}>3. ¿Has pensado en cómo podrías hacerlo?</Text>
              <View style={{ marginTop: 8 }}>
                <YesNoButtons value={answers.q3_metodo} onChange={(v) => set("q3_metodo", v)} />
              </View>
            </View>
            <View style={[styles.questionCard, styles.branchCard]}>
              <Text style={styles.questionText}>
                4. ¿Has tenido esos pensamientos con alguna intención de llevarlos a cabo?
              </Text>
              <View style={{ marginTop: 8 }}>
                <YesNoButtons
                  value={answers.q4_intencion}
                  onChange={(v) => set("q4_intencion", v)}
                />
              </View>
            </View>
            <View style={[styles.questionCard, styles.branchCard]}>
              <Text style={styles.questionText}>
                5. ¿Has empezado a planear los detalles de cómo hacerlo, con intención de llevarlo a
                cabo?
              </Text>
              <View style={{ marginTop: 8 }}>
                <YesNoButtons value={answers.q5_plan} onChange={(v) => set("q5_plan", v)} />
              </View>
            </View>
          </>
        )}

        <View style={styles.questionCard}>
          <Text style={styles.questionText}>
            6. ¿Alguna vez hiciste algo, empezaste a hacer algo, o te preparaste para hacer algo
            para terminar con tu vida?
          </Text>
          <View style={{ marginTop: 8 }}>
            <YesNoButtons
              value={answers.q6_comportamiento}
              onChange={(v) => set("q6_comportamiento", v)}
            />
          </View>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          style={[styles.submitButton, (!allAnswered || submitting) && { opacity: 0.5 }]}
          disabled={!allAnswered || submitting}
          onPress={handleSubmit}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Enviar evaluación</Text>
          )}
        </Pressable>
      </View>
    </>
  );
}

function ResultScreen({
  title,
  scoreLine,
  showCrisisNotice,
  onDone,
}: {
  title: string;
  scoreLine: string;
  showCrisisNotice: boolean;
  onDone: () => void;
}) {
  return (
    <>
      <Stack.Screen options={{ title }} />
      <View
        style={[styles.container, { padding: 24, alignItems: "center", justifyContent: "center" }]}
      >
        <Text style={{ fontSize: 14, color: colors.mutedForeground }}>Resultado</Text>
        <Text
          style={{
            fontSize: 24,
            fontWeight: "800",
            color: colors.primary,
            marginTop: 4,
            marginBottom: 20,
          }}
        >
          {scoreLine}
        </Text>
        {showCrisisNotice && (
          <View style={styles.crisisBox}>
            <Text style={styles.crisisText}>
              Tus respuestas indican que puede haber riesgo para tu seguridad. Ya enviamos una
              alerta directa a tu terapeuta asignado, quien se pondrá en contacto contigo lo antes
              posible. Si en este momento estás en peligro, acude al servicio de urgencias más
              cercano.
            </Text>
          </View>
        )}
        <Text
          style={{
            fontSize: 13,
            color: colors.mutedForeground,
            textAlign: "center",
            marginVertical: 16,
          }}
        >
          Esta evaluación quedó registrada y tu terapeuta podrá verla en tu próxima sesión.
        </Text>
        <Pressable style={styles.submitButton} onPress={onDone}>
          <Text style={styles.submitText}>Cerrar</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  instructions: { fontSize: 13, color: colors.mutedForeground },
  questionCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  branchCard: { borderColor: "#fcd34d", backgroundColor: "#fffbeb" },
  questionText: { fontSize: 14, fontWeight: "600", color: "#1e293b" },
  optionRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  optionRowActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionText: { fontSize: 13, color: "#475569" },
  optionTextActive: { color: colors.primary, fontWeight: "700" },
  yesNoButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  noActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  yesActive: { borderColor: "#f87171", backgroundColor: "#fef2f2" },
  yesNoText: { fontWeight: "700", color: "#475569" },
  noActiveText: { color: colors.primary },
  yesActiveText: { color: "#b91c1c" },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  crisisBox: {
    borderWidth: 1,
    borderColor: colors.dangerBg,
    backgroundColor: colors.dangerBg,
    borderRadius: 12,
    padding: 14,
  },
  crisisText: { fontSize: 13, color: colors.danger, lineHeight: 19 },
});
