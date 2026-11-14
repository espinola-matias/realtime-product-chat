import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MessageBubble } from '../components/MessageBubble';
import { colors } from '../components/theme';
import type { ChatMessage, Sender } from '../interfaces/chat-message.interface';
import {
  listenConnection,
  listenMessages,
  MAX_TEXT_LENGTH,
  sendTextMessage,
} from '../services/chat.service';

const VIEWER: Sender = 'cliente';

interface ChatScreenProps {
  chatId: string;
}

export function ChatScreen({ chatId }: ChatScreenProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [listenError, setListenError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  // Listener propio en tiempo real de /chats/{chatId}/messages.
  useEffect(() => {
    setLoading(true);
    setListenError(null);
    const unsubscribe = listenMessages(
      chatId,
      (next) => {
        setMessages(next);
        setLoading(false);
      },
      (error) => {
        setListenError(error.message);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [chatId]);

  useEffect(() => listenConnection(setConnected), []);

  // La lista va invertida para quedar pegada abajo: el más nuevo primero.
  const listData = useMemo(() => [...messages].reverse(), [messages]);

  const handleSend = useCallback(async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    setSendError(null);
    try {
      await sendTextMessage(chatId, VIEWER, draft);
      setDraft('');
    } catch (error: unknown) {
      setSendError(error instanceof Error ? error.message : 'No se pudo enviar el mensaje');
    } finally {
      setSending(false);
    }
  }, [chatId, draft, sending]);

  const renderItem: ListRenderItem<ChatMessage> = useCallback(({ item }) => {
    switch (item.type) {
      case 'text':
      case 'order_accepted':
        return <MessageBubble message={item} viewer={VIEWER} />;
      case 'product_offer':
        // ProductOfferCard llega en la etapa E4.
        return (
          <Text style={styles.hint}>
            Oferta: {item.product.name} ({item.status})
          </Text>
        );
    }
  }, []);

  const canSend = draft.trim().length > 0 && !sending;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Comercio</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            Cliente · chat {chatId}
          </Text>
        </View>
        <View style={[styles.status, connected && styles.statusOn]}>
          <Text style={[styles.statusText, connected && styles.statusTextOn]}>
            {connected ? 'En línea' : 'Sin conexión'}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView style={styles.body} behavior="padding">
        {listenError && (
          <Text style={styles.error} accessibilityRole="alert">
            {listenError}
          </Text>
        )}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.hint}>Cargando mensajes…</Text>
          </View>
        ) : (
          <FlatList
            style={styles.list}
            contentContainerStyle={styles.listContent}
            data={listData}
            inverted
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={[styles.hint, styles.flipped]}>Aún no hay mensajes. Escriba el primero.</Text>
            }
          />
        )}

        {sendError && (
          <Text style={styles.error} accessibilityRole="alert">
            {sendError}
          </Text>
        )}

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Escriba un mensaje…"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={MAX_TEXT_LENGTH}
            accessibilityLabel="Mensaje"
          />
          <Pressable
            style={({ pressed }) => [
              styles.sendButton,
              !canSend && styles.sendButtonDisabled,
              pressed && canSend && styles.sendButtonPressed,
            ]}
            onPress={() => void handleSend()}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Enviar mensaje"
          >
            <Text style={styles.sendButtonText}>{sending ? '…' : 'Enviar'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surfaceRaised },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  headerText: { flex: 1 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  status: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.dangerSoft,
  },
  statusOn: { backgroundColor: colors.successSoft },
  statusText: { fontSize: 12, color: colors.dangerText },
  statusTextOn: { color: colors.successText },
  body: { flex: 1, backgroundColor: colors.bg },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 12, paddingVertical: 12, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  hint: { alignSelf: 'center', marginVertical: 8, fontSize: 13, color: colors.textMuted },
  // ListEmptyComponent también se invierte con la lista: se corrige aquí.
  flipped: { transform: [{ scaleY: -1 }] },
  error: {
    marginHorizontal: 12,
    marginVertical: 6,
    padding: 10,
    borderRadius: 8,
    backgroundColor: colors.dangerSoft,
    color: colors.dangerText,
    fontSize: 13,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 15,
  },
  sendButton: {
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonPressed: { opacity: 0.8 },
  sendButtonText: { color: colors.onAccent, fontWeight: '700', fontSize: 15 },
});
