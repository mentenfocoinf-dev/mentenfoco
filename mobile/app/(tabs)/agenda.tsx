import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, Linking } from "react-native";
import { useAuth } from "../../src/hooks/useAuth";
import { getPatientSessions, type TherapySession, type SessionStatus } from "../../src/lib/api/sessionsService";
import { ScreenContainer, Card, ScreenTitle, EmptyState } from "../../src/components/ui";
import { colors } from "../../src/theme/colors";

// Mismo mapeo de colores por estado que WeeklyAgenda.tsx (web), en versión hex.
const STATUS_STYLES: Record<SessionStatus, { bg: string; fg: string; label: string }> = {
  programada: { bg: colors.primarySoft, fg: colors.primary, label: "Programada" },
  confirmada: { bg: colors.successBg, fg: colors.success, label: "Confirmada" },
  completada: { bg: colors.muted, fg: colors.mutedForeground, label: "Completada" },
  cancelada: { bg: colors.dangerBg, fg: colors.danger, label: "Cancelada" },
  no_asistio: { bg: colors.warningBg, fg: colors.warning, label: "No asistió" },
};

function SessionRow({ session }: { session: TherapySession }) {
  const style = STATUS_STYLES[session.status];
  const date = new Date(session.scheduled_at);
  const canJoin =
    session.video_call_link &&
    (session.status === "programada" || session.status === "confirmada");

  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowDate}>
          {date.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}
        </Text>
        <Text style={styles.rowTime}>
          {date.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })} · {session.duration_minutes} min
        </Text>
        <View style={[styles.badge, { backgroundColor: style.bg }]}>
          <Text style={[styles.badgeText, { color: style.fg }]}>{style.label}</Text>
        </View>
      </View>
      {canJoin && (
        <Pressable style={styles.joinButton} onPress={() => Linking.openURL(session.video_call_link!)}>
          <Text style={styles.joinButtonText}>Unirme</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function AgendaScreen() {
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<TherapySession[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      setSessions(await getPatientSessions(profile.id));
    } catch (err) {
      console.error("[Agenda] Error cargando sesiones:", err);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  if (!profile) return null;

  const now = Date.now();
  const upcoming = sessions
    .filter((s) => s.status !== "cancelada" && new Date(s.scheduled_at).getTime() >= now)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const past = sessions
    .filter((s) => !(s.status !== "cancelada" && new Date(s.scheduled_at).getTime() >= now))
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());

  return (
    <ScreenContainer refreshing={loading} onRefresh={load}>
      <ScreenTitle>Mi agenda</ScreenTitle>
      <Text style={styles.subtitle}>
        Tu terapeuta programa las sesiones desde su panel. Aquí puedes verlas y unirte cuando llegue la hora.
      </Text>

      <Card>
        <Text style={styles.sectionTitle}>Próximas sesiones</Text>
        {upcoming.length > 0 ? (
          <View style={{ gap: 10, marginTop: 8 }}>
            {upcoming.map((s) => (
              <SessionRow key={s.id} session={s} />
            ))}
          </View>
        ) : (
          <EmptyState text="No tienes sesiones próximas agendadas." />
        )}
      </Card>

      {past.length > 0 && (
        <Card>
          <Text style={styles.sectionTitle}>Historial</Text>
          <View style={{ gap: 10, marginTop: 8 }}>
            {past.map((s) => (
              <SessionRow key={s.id} session={s} />
            ))}
          </View>
        </Card>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 13, color: colors.mutedForeground },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.primary },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  rowDate: { fontSize: 13, fontWeight: "700", color: "#1e293b", textTransform: "capitalize" },
  rowTime: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  badge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 },
  badgeText: { fontSize: 10, fontWeight: "700" },
  joinButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  joinButtonText: { color: "#fff", fontWeight: "700", fontSize: 12 },
});
