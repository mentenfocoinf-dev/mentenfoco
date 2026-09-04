// Bloques de UI compartidos y minimalistas para el scaffold inicial. Claude Code puede
// reemplazarlos por componentes más pulidos (o una librería como Tamagui/NativeBase) más
// adelante — lo importante en esta primera versión es que la lógica de datos sea correcta.
import { View, Text, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ReactNode } from "react";
import { colors } from "../theme/colors";

export function ScreenContainer({
  children,
  refreshing,
  onRefresh,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  // Respetamos los insets del dispositivo (notch, barra de estado, gesto inferior). Sin esto el
  // contenido arranca debajo de la barra de estado y el final queda tapado por la tab bar.
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingLeft: insets.left + 16,
        paddingRight: insets.right + 16,
        paddingBottom: insets.bottom + 40,
        gap: 16,
      }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function ScreenTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export function Badge({
  children,
  tone = "primary",
}: {
  children: ReactNode;
  tone?: "primary" | "success" | "warning" | "danger";
}) {
  const toneStyles = {
    primary: { bg: colors.primarySoft, fg: colors.primary },
    success: { bg: colors.successBg, fg: colors.success },
    warning: { bg: colors.warningBg, fg: colors.warning },
    danger: { bg: colors.dangerBg, fg: colors.danger },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: toneStyles.bg }]}>
      <Text style={[styles.badgeText, { color: toneStyles.fg }]}>{children}</Text>
    </View>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  title: { fontSize: 24, fontWeight: "700", color: colors.primary },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 11, fontWeight: "700" },
  empty: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
  },
  emptyText: { color: colors.mutedForeground, fontSize: 13, textAlign: "center" },
});
