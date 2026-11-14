import { StyleSheet, Text, View } from 'react-native';
import type { OrderAcceptedMessage, Sender, TextMessage } from '../interfaces/chat-message.interface';
import { colors } from './theme';

interface MessageBubbleProps {
  message: TextMessage | OrderAcceptedMessage;
  /** Quién está viendo el chat: sus mensajes van a la derecha. */
  viewer: Sender;
}

const senderLabel: Record<Sender, string> = { cliente: 'Cliente', comercio: 'Comercio' };

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
        {!own && <Text style={styles.sender}>{senderLabel[message.sender]}</Text>}
        <Text
          style={[
            styles.text,
            own && !isConfirmation && styles.textOwn,
            isConfirmation && styles.textConfirmation,
          ]}
        >
          {message.text}
        </Text>
        <Text style={[styles.time, own && !isConfirmation && styles.timeOwn]}>
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
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    borderRadius: 14,
  },
  bubbleOwn: { backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: colors.bubbleOther, borderBottomLeftRadius: 4 },
  bubbleConfirmation: {
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  sender: { fontSize: 12, fontWeight: '600', color: colors.accent, marginBottom: 2 },
  text: { fontSize: 15, lineHeight: 20, color: colors.text },
  textOwn: { color: colors.onAccent },
  textConfirmation: { color: colors.successText },
  time: { alignSelf: 'flex-end', fontSize: 11, marginTop: 2, color: colors.textMuted },
  timeOwn: { color: colors.onAccentMuted },
});
