import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { ScreenContainer, Card, Badge } from "../../src/components/ui";
import { getGuide, type GuideFull, type GuideMeta } from "../../src/lib/api/guidesService";
import { PLAN_LABELS } from "../../src/lib/api/plans";
import { colors } from "../../src/theme/colors";

// Detalle de guía. Si RLS/plan no permiten el contenido completo, getGuide devuelve solo los
// metadatos públicos y mostramos el paywall — mismo comportamiento que /guias/$guiaId en la web.
export default function GuiaDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [guia, setGuia] = useState<GuideFull | null>(null);
  const [meta, setMeta] = useState<GuideMeta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getGuide(id)
      .then(({ guia, meta }) => {
        setGuia(guia);
        setMeta(meta);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const titulo = guia?.titulo ?? meta?.titulo ?? "Guía";

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: titulo }} />
      <ScreenContainer>
        {guia ? (
          <>
            <View>
              <Badge tone="primary">{guia.categoria}</Badge>
              <Text style={styles.titulo}>{guia.titulo}</Text>
              <Text style={styles.tiempo}>{guia.tiempoLectura} de lectura</Text>
            </View>

            <Card>
              <Text style={styles.seccion}>Fundamento clínico</Text>
              <Text style={styles.cuerpo}>{guia.fundamentoClinico}</Text>
            </Card>

            <Card>
              <Text style={styles.seccion}>Ejercicio práctico</Text>
              <Text style={styles.cuerpo}>{guia.ejercicioPractico}</Text>
            </Card>

            {guia.contenidoCompleto && (
              <Card>
                <Text style={styles.seccion}>Contenido completo</Text>
                <Text style={styles.cuerpo}>{guia.contenidoCompleto}</Text>
              </Card>
            )}
          </>
        ) : meta ? (
          <>
            <View>
              <Badge tone="warning">🔒 Contenido bloqueado</Badge>
              <Text style={styles.titulo}>{meta.titulo}</Text>
              <Text style={styles.descripcion}>{meta.descripcionBreve}</Text>
            </View>
            <Card>
              <Text style={styles.seccion}>Esta guía requiere {PLAN_LABELS[meta.min_plan]}</Text>
              <Text style={styles.cuerpo}>
                Tu plan actual no incluye el contenido completo de esta guía. Puedes mejorar tu plan
                desde el sitio web de Mente en Foco para desbloquearla junto con el resto del
                contenido clínico.
              </Text>
            </Card>
          </>
        ) : (
          <Card>
            <Text style={styles.cuerpo}>No encontramos esta guía.</Text>
          </Card>
        )}
      </ScreenContainer>
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  titulo: { fontSize: 22, fontWeight: "700", color: colors.primary, marginTop: 8 },
  tiempo: { fontSize: 13, color: colors.mutedForeground, marginTop: 4 },
  descripcion: { fontSize: 14, color: colors.mutedForeground, marginTop: 6, lineHeight: 20 },
  seccion: { fontSize: 15, fontWeight: "700", color: colors.primary, marginBottom: 8 },
  cuerpo: { fontSize: 14, color: colors.secondaryForeground, lineHeight: 21 },
});
