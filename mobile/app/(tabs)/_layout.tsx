import { Tabs } from "expo-router";
import { Text } from "react-native";
import { colors } from "../../src/theme/colors";

// Iconos simples con emoji/texto para no depender de un paquete de íconos adicional en este
// primer scaffold — Claude Code puede reemplazarlos por @expo/vector-icons (ya viene con Expo)
// cuando pula la UI.
function TabIcon({ symbol }: { symbol: string }) {
  return <Text style={{ fontSize: 20 }}>{symbol}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Inicio", tabBarIcon: () => <TabIcon symbol="🏠" /> }}
      />
      <Tabs.Screen
        name="progreso"
        options={{ title: "Progreso", tabBarIcon: () => <TabIcon symbol="📈" /> }}
      />
      <Tabs.Screen
        name="evaluaciones"
        options={{ title: "Evaluaciones", tabBarIcon: () => <TabIcon symbol="📋" /> }}
      />
      <Tabs.Screen
        name="guias"
        options={{ title: "Guías", tabBarIcon: () => <TabIcon symbol="📖" /> }}
      />
      <Tabs.Screen
        name="agenda"
        options={{ title: "Agenda", tabBarIcon: () => <TabIcon symbol="📅" /> }}
      />
      <Tabs.Screen
        name="mensajes"
        options={{ title: "Mensajes", tabBarIcon: () => <TabIcon symbol="💬" /> }}
      />
    </Tabs>
  );
}
