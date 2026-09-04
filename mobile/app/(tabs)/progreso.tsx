import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAuth } from "../../src/hooks/useAuth";
import {
  getPatientAnamnesis,
  getPatientEvaluations,
  type AnamnesisSummary,
  type PsychometricEvaluation,
} from "../../src/lib/api/clinicalService";
import {
  ScreenContainer,
  Card,
  ScreenTitle,
  SectionLabel,
  EmptyState,
} from "../../src/components/ui";
import { colors } from "../../src/theme/colors";

const SCALE_LABELS: Record<string, string> = {
  phq9: "PHQ-9 (Depresión)",
  gad7: "GAD-7 (Ansiedad)",
  cssrs: "C-SSRS (Seguridad)",
  moca: "MoCA (Cognitivo)",
  mmse: "MMSE (Cognitivo)",
};

// Gráfico simple con barras (sin librería externa, para no engordar el bundle en este primer
// scaffold). Claude Code puede reemplazarlo por victory-native o react-native-svg más adelante
// si se quiere un gráfico de línea real como el de la web (recharts).
function TrendBars({
  evaluations,
  scaleType,
  maxScore,
}: {
  evaluations: PsychometricEvaluation[];
  scaleType: string;
  maxScore: number;
}) {
  const points = evaluations
    .filter((e) => e.scale_type === scaleType)
    .slice()
    .reverse()
    .slice(-8); // últimas 8 evaluaciones, en orden cronológico

  if (points.length === 0) return null;

  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.trendLabel}>{SCALE_LABELS[scaleType]}</Text>
      <View style={styles.barsRow}>
        {points.map((p, i) => (
          <View key={i} style={styles.barColumn}>
            <View style={[styles.bar, { height: Math.max(6, (p.total_score / maxScore) * 60) }]} />
            <Text style={styles.barValue}>{p.total_score}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function ProgresoScreen() {
  const { profile } = useAuth();
  const [anamnesis, setAnamnesis] = useState<AnamnesisSummary | null>(null);
  const [evaluations, setEvaluations] = useState<PsychometricEvaluation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const [a, evals] = await Promise.all([
        getPatientAnamnesis(profile.id),
        getPatientEvaluations(profile.id),
      ]);
      setAnamnesis(a);
      setEvaluations(evals);
    } catch (err) {
      console.error("[Progreso] Error cargando datos:", err);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  if (!profile) return null;

  const anamnesisData = anamnesis?.data ?? null;
  const hasPhq9 = evaluations.some((e) => e.scale_type === "phq9");
  const hasGad7 = evaluations.some((e) => e.scale_type === "gad7");

  return (
    <ScreenContainer refreshing={loading} onRefresh={load}>
      <ScreenTitle>Mi progreso</ScreenTitle>

      <Card>
        <SectionLabel>Tendencia</SectionLabel>
        {hasPhq9 || hasGad7 ? (
          <View style={{ gap: 16, marginTop: 8 }}>
            {hasPhq9 && <TrendBars evaluations={evaluations} scaleType="phq9" maxScore={27} />}
            {hasGad7 && <TrendBars evaluations={evaluations} scaleType="gad7" maxScore={21} />}
          </View>
        ) : (
          <EmptyState text="Completa al menos una evaluación PHQ-9 o GAD-7 para ver tu progreso aquí." />
        )}
      </Card>

      <Card>
        <SectionLabel>Historial de evaluaciones</SectionLabel>
        {evaluations.length > 0 ? (
          <View style={{ gap: 8, marginTop: 8 }}>
            {evaluations.map((ev, i) => (
              <View key={i} style={styles.historyRow}>
                <Text style={styles.historyScale}>
                  {SCALE_LABELS[ev.scale_type] ?? ev.scale_type}
                </Text>
                <Text style={styles.historyScore}>
                  {ev.scale_type === "cssrs"
                    ? `Riesgo: ${ev.severity_level}`
                    : `${ev.total_score} pts · ${ev.severity_level ?? "—"}`}
                </Text>
                <Text style={styles.historyDate}>
                  {new Date(ev.evaluated_at).toLocaleDateString("es-CO")}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState text="Aún no tienes evaluaciones registradas." />
        )}
      </Card>

      <Card>
        <SectionLabel>Tu anamnesis</SectionLabel>
        {anamnesisData ? (
          <View style={{ gap: 10, marginTop: 8 }}>
            {typeof anamnesisData.motivo_consulta === "string" && anamnesisData.motivo_consulta ? (
              <View>
                <Text style={styles.anamnesisLabel}>Motivo de consulta</Text>
                <Text style={styles.anamnesisValue}>{anamnesisData.motivo_consulta}</Text>
              </View>
            ) : null}
            {typeof anamnesisData.red_apoyo === "string" && anamnesisData.red_apoyo ? (
              <View>
                <Text style={styles.anamnesisLabel}>Red de apoyo</Text>
                <Text style={styles.anamnesisValue}>{anamnesisData.red_apoyo}</Text>
              </View>
            ) : null}
            {anamnesis?.audit_c_score != null ? (
              <View>
                <Text style={styles.anamnesisLabel}>Consumo de alcohol (AUDIT-C)</Text>
                <Text style={styles.anamnesisValue}>{anamnesis.audit_c_score} pts</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <EmptyState text="Aún no has completado tu formulario de anamnesis. Complétalo desde la versión web de Mente en Foco." />
        )}
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  trendLabel: { fontSize: 12, fontWeight: "700", color: colors.primary },
  barsRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, height: 80 },
  barColumn: { alignItems: "center", gap: 4 },
  bar: { width: 14, backgroundColor: colors.primary, borderRadius: 4 },
  barValue: { fontSize: 10, color: colors.mutedForeground },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 8,
  },
  historyScale: { fontSize: 12, fontWeight: "700", color: "#1e293b", flex: 1 },
  historyScore: { fontSize: 12, color: colors.mutedForeground, flex: 1, textAlign: "center" },
  historyDate: { fontSize: 11, color: colors.mutedForeground },
  anamnesisLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.mutedForeground,
    textTransform: "uppercase",
  },
  anamnesisValue: { fontSize: 13, color: "#1e293b", marginTop: 2 },
});
