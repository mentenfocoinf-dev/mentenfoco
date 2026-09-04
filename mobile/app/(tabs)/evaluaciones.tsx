import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/hooks/useAuth";
import {
  getLatestEvaluationsByScale,
  type PsychometricEvaluation,
} from "../../src/lib/api/clinicalService";
import { ScreenContainer, Card, ScreenTitle } from "../../src/components/ui";
import { colors } from "../../src/theme/colors";

const SCALES = [
  { key: "phq9", label: "PHQ-9 (Depresión)" },
  { key: "gad7", label: "GAD-7 (Ansiedad)" },
  { key: "cssrs", label: "C-SSRS (Seguridad)" },
] as const;

export default function EvaluacionesScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [recent, setRecent] = useState<Record<string, PsychometricEvaluation>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      setRecent(await getLatestEvaluationsByScale(profile.id));
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScreenContainer refreshing={loading} onRefresh={load}>
      <ScreenTitle>Evaluaciones de bienestar</ScreenTitle>
      <Text style={styles.subtitle}>
        Cuestionarios breves y validados clínicamente que ayudan a tu terapeuta a hacer seguimiento
        de tu evolución.
      </Text>

      {SCALES.map(({ key, label }) => {
        const last = recent[key];
        return (
          <Card key={key}>
            <Text style={styles.scaleLabel}>{label}</Text>
            {last ? (
              <Text style={styles.scaleResult}>
                {key === "cssrs"
                  ? `Riesgo: ${last.severity_level}`
                  : `${last.total_score} pts · ${last.severity_level}`}
                {"  ·  "}
                {new Date(last.evaluated_at).toLocaleDateString("es-CO")}
              </Text>
            ) : (
              <Text style={styles.scaleResult}>Sin evaluaciones aún</Text>
            )}
            <Pressable
              style={styles.button}
              onPress={() =>
                router.push({ pathname: "/evaluacion/[scale]", params: { scale: key } })
              }
            >
              <Text style={styles.buttonText}>
                {last ? "Volver a evaluar" : "Empezar evaluación"}
              </Text>
            </Pressable>
          </Card>
        );
      })}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 13, color: colors.mutedForeground },
  scaleLabel: { fontSize: 14, fontWeight: "700", color: "#1e293b" },
  scaleResult: { fontSize: 12, color: colors.mutedForeground },
  button: {
    marginTop: 8,
    backgroundColor: colors.primarySoft,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  buttonText: { color: colors.primary, fontWeight: "700", fontSize: 13 },
});
