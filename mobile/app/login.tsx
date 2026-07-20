import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { signIn } from "../src/lib/api/authService";
import { colors } from "../src/theme/colors";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit() {
    setErrorMsg(null);
    if (!email || !password) {
      setErrorMsg("Ingresa tu correo y tu contraseña.");
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      // La navegación a (tabs) la resuelve _layout.tsx al detectar la sesión.
    } catch (err: any) {
      setErrorMsg(err.message ?? "No pudimos iniciar sesión.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* ScrollView + insets: en pantallas chicas o con el teclado abierto, el formulario se
          desplaza en vez de quedar cortado. */}
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
            paddingLeft: insets.left + 24,
            paddingRight: insets.right + 24,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
      <View style={styles.header}>
        <Text style={styles.title}>Mente en Foco</Text>
        <Text style={styles.subtitle}>Tu espacio de acompañamiento psicológico</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Correo electrónico</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="tu@correo.com"
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />

        <Text style={styles.label}>Contraseña</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
          style={styles.input}
        />

        {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}

        <Pressable style={styles.button} onPress={handleSubmit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={styles.buttonText}>Ingresar</Text>
          )}
        </Pressable>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: "center" },
  header: { marginBottom: 32, alignItems: "center" },
  title: { fontSize: 28, fontWeight: "700", color: colors.primary },
  subtitle: { fontSize: 14, color: colors.mutedForeground, marginTop: 4, textAlign: "center" },
  form: { gap: 6 },
  label: { fontSize: 13, fontWeight: "600", color: colors.primary, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginTop: 4,
  },
  error: {
    color: colors.destructive,
    fontSize: 13,
    marginTop: 12,
    textAlign: "center",
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
  },
  buttonText: { color: colors.primaryForeground, fontSize: 15, fontWeight: "700" },
});
