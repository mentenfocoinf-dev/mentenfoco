import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useAuth } from "../../src/hooks/useAuth";
import { supabase } from "../../src/lib/supabase";
import {
  getAssignedTherapistId,
  getConversation,
  sendMessage,
  markConversationAsRead,
  type Message,
} from "../../src/lib/api/messagesService";
import { ScreenTitle, EmptyState } from "../../src/components/ui";
import { colors } from "../../src/theme/colors";

function Bubble({ message, isMine }: { message: Message; isMine: boolean }) {
  return (
    <View style={[styles.bubbleRow, isMine ? { justifyContent: "flex-end" } : { justifyContent: "flex-start" }]}>
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text style={isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs}>{message.body}</Text>
        <Text style={[styles.bubbleTime, isMine && { color: "rgba(255,255,255,0.7)" }]}>
          {new Date(message.created_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>
    </View>
  );
}

export default function MensajesScreen() {
  const { profile } = useAuth();
  const [therapistId, setTherapistId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const tId = await getAssignedTherapistId(profile.id);
      setTherapistId(tId);
      if (tId) {
        const conv = await getConversation(profile.id, tId);
        setMessages(conv);
        await markConversationAsRead(profile.id, tId, profile.id);
      }
    } catch (err) {
      console.error("[Mensajes] Error cargando conversación:", err);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  // Suscripción realtime — mismo canal que usa la web (ChatThread.tsx) para nuevos mensajes.
  useEffect(() => {
    if (!profile || !therapistId) return;
    const channel = supabase
      .channel(`patient_messages_${profile.id}_${therapistId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `patient_id=eq.${profile.id}`,
        },
        (payload) => {
          const msg = payload.new as Message;
          if (msg.therapist_id !== therapistId) return;
          setMessages((prev) => [...prev, msg]);
          if (msg.sender_id !== profile.id) {
            markConversationAsRead(profile.id, therapistId, profile.id).catch(() => {});
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, therapistId]);

  async function handleSend() {
    if (!draft.trim() || !profile || !therapistId || sending) return;
    setSending(true);
    const body = draft.trim();
    setDraft("");
    try {
      const sent = await sendMessage({ patientId: profile.id, therapistId, senderId: profile.id, body });
      setMessages((prev) => [...prev, sent]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      console.error("[Mensajes] Error enviando mensaje:", err);
      setDraft(body);
    } finally {
      setSending(false);
    }
  }

  if (!profile) return null;

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!therapistId) {
    return (
      <View style={[styles.container, { padding: 16 }]}>
        <ScreenTitle>Mensajes</ScreenTitle>
        <EmptyState text="Aún no tienes un terapeuta asignado. Cuando te asignen uno, podrás escribirle aquí." />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.header}>
        <ScreenTitle>Mensajes</ScreenTitle>
        <Text style={styles.headerSubtitle}>Conversación con tu terapeuta</Text>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        renderItem={({ item }) => <Bubble message={item} isMine={item.sender_id === profile.id} />}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={<EmptyState text="Aún no hay mensajes. Escribe el primero." />}
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Escribe un mensaje..."
          placeholderTextColor={colors.mutedForeground}
          multiline
        />
        <Pressable style={[styles.sendButton, (!draft.trim() || sending) && { opacity: 0.5 }]} onPress={handleSend} disabled={!draft.trim() || sending}>
          <Text style={styles.sendButtonText}>Enviar</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 16, paddingTop: 16 },
  headerSubtitle: { fontSize: 13, color: colors.mutedForeground, marginTop: 2, marginBottom: 4 },
  bubbleRow: { flexDirection: "row" },
  bubble: { maxWidth: "80%", borderRadius: 16, paddingVertical: 8, paddingHorizontal: 12 },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  bubbleTextMine: { color: "#fff", fontSize: 14 },
  bubbleTextTheirs: { color: "#1e293b", fontSize: 14 },
  bubbleTime: { fontSize: 10, color: colors.mutedForeground, marginTop: 4, textAlign: "right" },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 14,
    color: "#1e293b",
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  sendButtonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
