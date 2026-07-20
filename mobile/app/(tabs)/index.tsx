import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/hooks/useAuth";
import { getPatientSessions, type TherapySession } from "../../src/lib/api/sessionsService";
import { getPatientUnreadCount } from "../../src/lib/api/messagesService";
import { PLAN_LABELS } from "../../src/lib/api/plans";
import { signOut } from "../../src/lib/api/authService";
import { ScreenContainer, Card, ScreenTitle, Badge, EmptyState } from "../../src/components/ui";
import { colors } from "../../src/theme/colors";

export default function InicioScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [nextSession, setNextSession] = useState<TherapySession | null>(null);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const [sessions, unreadCount] = await Promise.all([
        getPatientSessions(profile.id),
        getPatientUnreadCount(profile.id),
      ]);
      const now = Date.now();
      const upcoming = sessions
        .filter((s) => s.status !== "cancelada" && new Date(s.scheduled_at).getTime() >= now)
        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
      setNextSession(upcoming[0] ?? null);
      setUnread(unreadCount);
    } catch (err) {
      console.error("[Inicio] Error cargando datos:", err);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  if (!profile) return null;

  const planLabel = PLAN_LABELS[profile.plan_type] ?? "Plan Gratuito";
  const displayName = profile.full_name ?? "Hola";

  return (
    <ScreenContainer refreshing={loading} onRefresh={load}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.greeting}>Bienvenido/a</Text>
          <ScreenTitle>{displayName}</ScreenTitle>
        </View>
        <Pressable onPress={() => signOut()}>
          <Text style={styles.logout}>Cerrar sesión</Text>
        </Pressable>
      </View>

      <Card>
        <Badge>{planLabel}</Badge>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Próxima sesión</Text>
        {nextSession ? (
          <>
            <Text style={styles.sessionDate}>
              {new Date(nextSession.scheduled_at).toLocaleString("es-CO", {
                dateStyle: "full",
                timeStyle: "short",
              })}
            </Text>
            {nextSession.video_call_link ? (
              <Text style={styles.link}>Enlace de videollamada disponible</Text>
            ) : (
              <Text style={styles.muted}>El enlace de videollamada aún no está disponible</Text>
            )}
          </>
        ) : (
          <EmptyState text="No tienes sesiones próximas. Tu terapeuta las agenda desde su panel." />
        )}
      </Card>

      <Pressable style={styles.quickCard} onPress={() => router.push("/(tabs)/mensajes")}>
        <Text style={styles.quickTitle}>Mensajes</Text>
        {unread > 0 ? <Badge tone="danger">{`${unread} nuevo${unread > 1 ? "s" : ""}`}</Badge> : <Text style={styles.muted}>Sin mensajes nuevos</Text>}
      </Pressable>

      <Pressable style={styles.quickCard} onPress={() => router.push("/(tabs)/evaluaciones")}>
        <Text style={styles.quickTitle}>Evaluaciones de bienestar</Text>
        <Text style={styles.muted}>Ver y completar cuestionarios</Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  greeting: { fontSize: 13, color: colors.mutedForeground },
  logout: { color: colors.primary, fontSize: 13, fontWeight: "600" },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.primary },
  sessionDate: { fontSize: 14, fontWeight: "600", color: "#1e293b" },
  link: { fontSize: 13, color: colors.success, fontWeight: "600" },
  muted: { fontSize: 13, color: colors.mutedForeground },
  quickCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  quickTitle: { fontSize: 14, fontWeight: "700", color: colors.primary },
});
