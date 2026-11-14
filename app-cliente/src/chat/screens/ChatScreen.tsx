import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
  type ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MessageBubble } from '../components/MessageBubble';
import { ProductOfferCard } from '../components/ProductOfferCard';
import { colors, fonts, radius } from '../components/theme';
import type { ChatMessage, ProductOfferMessage, Sender } from '../interfaces/chat-message.interface';
import {
  approveOffer,
  listenConnection,
  listenMessages,
  MAX_TEXT_LENGTH,
  rejectOffer,
  sendTextMessage,
} from '../services/chat.service';

const VIEWER: Sender = 'cliente';

const LOGO: ImageSourcePropType = require('../../../assets/logo.png');

const INPUT_MIN_HEIGHT = 44;

interface ChatScreenProps {
  chatId: string;
  /** URL base de la API NestJS (POST /orders al aprobar). */
  apiUrl: string;
}

type Banner = { kind: 'error' | 'info'; text: string } | null;

/** Tiempo que un aviso queda visible antes de cerrarse solo (igual que en el comercio). */
const BANNER_DURATION_MS = 5000;

const errorText = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export function ChatScreen({ chatId, apiUrl }: ChatScreenProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [listenError, setListenError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  // Ofertas con respuesta en curso. El ref bloquea el doble toque de forma síncrona;
  // el estado solo sirve para pintar los botones deshabilitados.
  const answeringRef = useRef(new Set<string>());
  const [answeringIds, setAnsweringIds] = useState<ReadonlySet<string>>(new Set());

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

  // Cada aviso nuevo se cierra solo a los 5 s (también se puede cerrar antes con la ×).
  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner(null), BANNER_DURATION_MS);
    return () => clearTimeout(timer);
  }, [banner]);

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

  /** Ejecuta una respuesta a la oferta impidiendo respuestas simultáneas sobre el mismo mensaje. */
  const runAnswer = useCallback(async (offerId: string, action: () => Promise<void>) => {
    if (answeringRef.current.has(offerId)) return;
    answeringRef.current.add(offerId);
    setAnsweringIds(new Set(answeringRef.current));
    setBanner(null);
    try {
      await action();
    } catch (error: unknown) {
      setBanner({ kind: 'error', text: errorText(error, 'No se pudo responder la oferta') });
    } finally {
      answeringRef.current.delete(offerId);
      setAnsweringIds(new Set(answeringRef.current));
    }
  }, []);

  const handleAccept = useCallback(
    (offer: ProductOfferMessage) =>
      void runAnswer(offer.id, async () => {
        const result = await approveOffer(apiUrl, chatId, offer.id);
        if (result.warning) {
          setBanner({ kind: 'info', text: `Pedido ${result.orderId} creado. Aviso: ${result.warning}` });
        }
      }),
    [apiUrl, chatId, runAnswer],
  );

  const handleReject = useCallback(
    (offer: ProductOfferMessage) => void runAnswer(offer.id, () => rejectOffer(chatId, offer.id)),
    [chatId, runAnswer],
  );

  const renderItem: ListRenderItem<ChatMessage> = useCallback(
    ({ item }) => {
      switch (item.type) {
        case 'text':
        case 'order_accepted':
          return <MessageBubble message={item} viewer={VIEWER} />;
        case 'product_offer':
          // Solo el cliente responde, y solo mientras la oferta esté pending (lo decide la tarjeta).
          return (
            <ProductOfferCard
              message={item}
              onAccept={handleAccept}
              onReject={handleReject}
              answering={answeringIds.has(item.id)}
            />
          );
      }
    },
    [answeringIds, handleAccept, handleReject],
  );

  const canSend = draft.trim().length > 0 && !sending;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header} accessibilityLabel={`Chat ${chatId}`}>
        <Image source={LOGO} style={styles.logo} accessibilityLabel="App Comercio" />
        <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
          <Text style={styles.titleBrand}>Cliente</Text>
          <Text style={styles.titleSep}> · </Text>
          Chat
        </Text>
        <View style={[styles.status, connected && styles.statusOn]}>
          <View style={[styles.statusDot, connected && styles.statusDotOn]} />
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
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.hint}>Cargando mensajes…</Text>
          </View>
        ) : (
          <FlatList
            style={styles.list}
            contentContainerStyle={styles.listContent}
            data={listData}
            extraData={answeringIds}
            inverted
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={[styles.hint, styles.flipped]}>Aún no hay mensajes. Escriba el primero.</Text>
            }
          />
        )}

        {banner && (
          <Pressable
            onPress={() => setBanner(null)}
            style={[styles.banner, banner.kind === 'error' ? styles.bannerError : styles.bannerInfo]}
            accessibilityRole="alert"
            accessibilityHint="Toque para cerrar"
          >
            <Text style={[styles.bannerText, banner.kind === 'error' ? styles.errorText : styles.infoText]}>
              {banner.text}
            </Text>
            <Text style={[styles.bannerClose, banner.kind === 'error' ? styles.errorText : styles.infoText]}>×</Text>
          </Pressable>
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
            selectionColor={colors.brandBright}
            cursorColor={colors.brandPressed}
            multiline
            // En web, multiline es un <textarea> que por defecto mide 2 filas y deja la
            // letra arriba con espacio sobrante: se fija en 1 fila (crece con maxHeight).
            numberOfLines={Platform.OS === 'web' ? 1 : undefined}
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
  safe: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  // El logo del cliente es un círculo blanco: borde suave para que no se pierda sobre la cabecera blanca.
  logo: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.borderStrong },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 20, color: colors.text, letterSpacing: -0.2 },
  titleBrand: { fontFamily: fonts.displayBold, color: colors.brandTextLarge },
  titleSep: { color: colors.textMuted },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.dangerSoft,
  },
  statusOn: { backgroundColor: colors.successSoft },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.dangerText },
  statusDotOn: { backgroundColor: colors.successText },
  statusText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.dangerText },
  statusTextOn: { color: colors.successText },
  body: { flex: 1, backgroundColor: colors.bg },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 14, paddingVertical: 14, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  hint: {
    alignSelf: 'center',
    marginVertical: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
  },
  // ListEmptyComponent también se invierte con la lista: se corrige aquí.
  flipped: { transform: [{ scaleY: -1 }] },
  error: {
    marginHorizontal: 12,
    marginVertical: 6,
    padding: 12,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.dangerSoft,
    color: colors.dangerText,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginVertical: 6,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  bannerError: { backgroundColor: colors.dangerSoft, borderColor: colors.dangerBorder },
  bannerInfo: { backgroundColor: colors.warningSoft, borderColor: colors.borderStrong },
  bannerText: { flex: 1, fontFamily: fonts.medium, fontSize: 13 },
  bannerClose: { fontFamily: fonts.bold, fontSize: 18, paddingHorizontal: 4 },
  errorText: { color: colors.dangerText },
  infoText: { color: colors.warningText },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  // Alto exacto de 1 línea: lineHeight 20 + padding 11×2 + borde 1×2 = 44 → texto centrado.
  input: {
    flex: 1,
    minHeight: INPUT_MIN_HEIGHT,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 11,
    lineHeight: 20,
    textAlignVertical: 'center',
    borderRadius: INPUT_MIN_HEIGHT / 2,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  sendButton: {
    height: INPUT_MIN_HEIGHT,
    paddingHorizontal: 20,
    borderRadius: radius.pill,
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  sendButtonDisabled: { opacity: 0.45 },
  sendButtonPressed: { backgroundColor: colors.brandPressed },
  sendButtonText: { color: colors.onBrand, fontFamily: fonts.bold, fontSize: 15 },
});
