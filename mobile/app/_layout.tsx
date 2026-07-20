import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../src/hooks/useAuth";
import { colors } from "../src/theme/colors";

function RootNavigation() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inTabs = segments[0] === "(tabs)";

    if (!session && inTabs) {
      router.replace("/login");
    } else if (session && !inTabs) {
      router.replace("/(tabs)");
    }
  }, [session, loading, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="evaluacion/[scale]" options={{ presentation: "modal", headerShown: true }} />
      <Stack.Screen name="guia/[id]" options={{ headerShown: true, title: "Guía" }} />
    </Stack>
  );
}

export default function RootLayout() {
  // SafeAreaProvider es obligatorio para que useSafeAreaInsets() devuelva valores reales; sin él
  // el contenido queda debajo del notch/barra de estado y se ve cortado.
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootNavigation />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
