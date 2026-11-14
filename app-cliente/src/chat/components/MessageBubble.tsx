import { Platform, StyleSheet, Text, View } from 'react-native';
import type { OrderAcceptedMessage, Sender, TextMessage } from '../interfaces/chat-message.interface';
import { colors, fonts, radius } from './theme';

interface MessageBubbleProps {
  message: TextMessage | OrderAcceptedMessage;
  /** Quién está viendo el chat: sus mensajes van a la derecha. */
  viewer: Sender;
}

const senderLabel: Record<Sender, string> = { cliente: 'CLIENTE', comercio: 'COMERCIO' };

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function MessageBubble({ message, viewer }: MessageBubbleProps) {
  const own = message.sender === viewer;
  const isConfirmation = message.type === 'order_accepted';

  return (
    <View style={[styles.row, own ? styles.rowOwn : styles.rowOther]}>
      <View
        style={[
          styles.bubble,
          own ? styles.bubbleOwn : styles.bubbleOther,
          isConfirmation && styles.bubbleConfirmation,
        ]}
      >
        {!own && (
          <View style={styles.senderChip}>
            <Text style={styles.sender}>{senderLabel[message.sender]}</Text>
          </View>
        )}
        <Text
          style={[
            styles.text,
            own ? styles.textOwn : styles.textOther,
            isConfirmation && styles.textConfirmation,
          ]}
        >
          {message.text}
        </Text>
        {message.type === 'order_accepted' && (
          <View style={styles.order} accessibilityLabel={`Número de pedido ${message.orderId}`}>
            <Text style={styles.orderLabel}>N.º DE PEDIDO</Text>
            {/* selectable: se puede mantener pulsado para copiar el UUID */}
            <Text style={styles.orderId} selectable>
              {message.orderId}
            </Text>
          </View>
        )}
        <Text
          style={[
            styles.time,
            own ? styles.timeOwn : styles.timeOther,
            isConfirmation && styles.timeConfirmation,
          ]}
        >
          {formatTime(message.createdAt)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginVertical: 4 },
  rowOwn: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 7,
    borderRadius: radius.lg,
    gap: 2,
  },
  // Cliente (propios): naranja claro, cola abajo a la derecha.
  bubbleOwn: {
    backgroundColor: colors.bubbleOwn,
    borderBottomRightRadius: 6,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  // Comercio: naranja medio, cola abajo a la izquierda.
  bubbleOther: { backgroundColor: colors.bubbleOther, borderBottomLeftRadius: 6 },
  bubbleConfirmation: {
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  // “COMERCIO” en una píldora clara: se distingue del texto del mensaje.
  senderChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.bubbleOtherNameBg,
  },
  sender: {
    fontFamily: fonts.extrabold,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.bubbleOtherName,
  },
  text: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  textOwn: { color: colors.bubbleOwnText },
  textOther: { color: colors.bubbleOtherText },
  textConfirmation: { color: colors.successText, fontFamily: fonts.medium },
  order: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.successBorder,
    backgroundColor: colors.surface,
    gap: 2,
  },
  orderLabel: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.6, color: colors.successText },
  orderId: {
    fontSize: 12,
    color: colors.text,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  time: { alignSelf: 'flex-end', fontFamily: fonts.semibold, fontSize: 11, marginTop: 2 },
  timeOwn: { color: colors.bubbleOwnTime },
  timeOther: { color: colors.bubbleOtherTime },
  timeConfirmation: { color: colors.successText },
});
