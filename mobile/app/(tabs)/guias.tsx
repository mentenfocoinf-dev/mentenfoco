import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer, Card, ScreenTitle, Badge, EmptyState } from "../../src/components/ui";
import { listGuides, type GuideMeta } from "../../src/lib/api/guidesService";
import { hasPlanAccess, PLAN_LABELS } from "../../src/lib/api/plans";
import { useAuth } from "../../src/hooks/useAuth";
import { colors } from "../../src/theme/colors";

// Guías clínicas con bloqueo por plan: el catálogo (metadatos) es público, pero el contenido
// completo depende del plan del usuario (min_plan de cada guía). Espejo de /guia en la web.
export default function GuiasScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [guides, setGuides] = useState<GuideMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categoria, setCategoria] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await listGuides();
    setGuides(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const categorias = useMemo(
    () => Array.from(new Set(guides.map((g) => g.categoria))).sort(),
    [guides],
  );
  const visibles = useMemo(
    () => (categoria ? guides.filter((g) => g.categoria === categoria) : guides),
    [guides, categoria],
  );

  const planLabel = PLAN_LABELS[profile?.plan_type ?? "free"];
  const bloqueadas = guides.filter((g) => !hasPlanAccess(profile, g.min_plan)).length;

  return (
    <ScreenContainer refreshing={refreshing} onRefresh={onRefresh}>
      <View>
        <ScreenTitle>Guías clínicas</ScreenTitle>
        <Text style={styles.subtitle}>
          {loading
            ? "Cargando catálogo..."
            : bloqueadas > 0
              ? `Tu ${planLabel.toLowerCase()} incluye ${guides.length - bloqueadas} de ${guides.length} guías.`
              : `Tu ${planLabel.toLowerCase()} incluye todas las guías.`}
        </Text>
      </View>

      {categorias.length > 0 && (
        <View style={styles.filtros}>
          <Pressable
            onPress={() => setCategoria(null)}
            style={[styles.chip, categoria === null && styles.chipActivo]}
          >
            <Text style={[styles.chipText, categoria === null && styles.chipTextActivo]}>
              Todas ({guides.length})
            </Text>
          </Pressable>
          {categorias.map((c) => (
            <Pressable
              key={c}
              onPress={() => setCategoria(c)}
              style={[styles.chip, categoria === c && styles.chipActivo]}
            >
              <Text style={[styles.chipText, categoria === c && styles.chipTextActivo]}>{c}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {!loading && visibles.length === 0 && <EmptyState text="No hay guías en esta categoría." />}

      {visibles.map((g) => {
        const desbloqueada = hasPlanAccess(profile, g.min_plan);
        return (
          <Pressable key={g.id} onPress={() => router.push(`/guia/${g.id}`)}>
            <Card>
              <View style={styles.cardHeader}>
                <Badge tone="primary">{g.categoria}</Badge>
                {desbloqueada ? (
                  <Text style={styles.tiempo}>{g.tiempoLectura}</Text>
                ) : (
                  <Badge tone="warning">🔒 {PLAN_LABELS[g.min_plan]}</Badge>
                )}
              </View>
              <Text style={styles.titulo}>{g.titulo}</Text>
              <Text style={styles.descripcion}>{g.descripcionBreve}</Text>
              <Text style={[styles.cta, !desbloqueada && styles.ctaBloqueada]}>
                {desbloqueada ? "Leer guía →" : "Mejora tu plan para leerla →"}
              </Text>
            </Card>
          </Pressable>
        );
      })}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 14, color: colors.mutedForeground, marginTop: 4 },
  filtros: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActivo: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.mutedForeground },
  chipTextActivo: { color: colors.primaryForeground },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  tiempo: { fontSize: 12, color: colors.mutedForeground },
  titulo: { fontSize: 16, fontWeight: "700", color: colors.primary, marginTop: 8 },
  descripcion: { fontSize: 13, color: colors.mutedForeground, marginTop: 4, lineHeight: 18 },
  cta: { fontSize: 13, fontWeight: "700", color: colors.primary, marginTop: 12 },
  ctaBloqueada: { color: colors.warning },
});
