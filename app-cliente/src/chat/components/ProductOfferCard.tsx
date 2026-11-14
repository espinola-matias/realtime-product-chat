import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { OfferStatus, ProductOfferMessage } from '../interfaces/chat-message.interface';
import { formatPrice } from '../services/currency';
import { colors } from './theme';

interface ProductOfferCardProps {
  message: ProductOfferMessage;
  /** Aprobar la oferta. Si no se pasa, la tarjeta no muestra botones. */
  onAccept?: (message: ProductOfferMessage) => void;
  /** Rechazar la oferta. Si no se pasa, la tarjeta no muestra botones. */
  onReject?: (message: ProductOfferMessage) => void;
  /** Hay una respuesta en curso: botones deshabilitados (evita doble respuesta). */
  answering?: boolean;
}

const statusLabel: Record<OfferStatus, string> = {
  pending: 'Pendiente',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
};

const badgeStyle: Record<OfferStatus, { bg: string; fg: string }> = {
  pending: { bg: colors.warningSoft, fg: colors.warningText },
  accepted: { bg: colors.successSoft, fg: colors.successText },
  rejected: { bg: colors.dangerSoft, fg: colors.dangerText },
};

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function ProductImage({ name, imageUrl }: { name: string; imageUrl?: string }) {
  const [failed, setFailed] = useState(false);

  if (!imageUrl || failed) {
    return (
      <View style={[styles.image, styles.imagePlaceholder]} accessibilityElementsHidden>
        <Text style={styles.imagePlaceholderText}>{name.charAt(0).toUpperCase() || '?'}</Text>
      </View>
    );
  }
  return (
    <Image
      style={styles.image}
      source={{ uri: imageUrl }}
      accessibilityLabel={name}
      onError={() => setFailed(true)}
    />
  );
}

export function ProductOfferCard({ message, onAccept, onReject, answering = false }: ProductOfferCardProps) {
  const { product, status } = message;
  const isPending = status === 'pending';
  const showActions = isPending && onAccept !== undefined && onReject !== undefined;
  const badge = badgeStyle[status];

  return (
    <View style={styles.row}>
      <View
        style={[styles.card, status === 'accepted' && styles.cardAccepted]}
        accessibilityLabel={`Oferta: ${product.name}, ${statusLabel[status]}`}
      >
        <View style={styles.header}>
          <Text style={styles.kicker}>OFERTA DEL COMERCIO</Text>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.fg }]}>{statusLabel[status]}</Text>
          </View>
        </View>

        <View style={styles.body}>
          <ProductImage name={product.name} imageUrl={product.imageUrl} />
          <View style={styles.info}>
            <Text style={[styles.name, status === 'rejected' && styles.strike]}>{product.name}</Text>
            <Text style={[styles.price, status === 'rejected' && styles.strike]}>
              {formatPrice(product.price, product.currency)}
            </Text>
            <Text style={styles.meta}>Ref. {product.id}</Text>
          </View>
        </View>

        {status === 'accepted' && message.orderId && (
          <Text style={styles.note} selectable>N.º de pedido {message.orderId}</Text>
        )}

        {showActions && (
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.button, styles.reject, (answering || pressed) && styles.dimmed]}
              onPress={() => onReject(message)}
              disabled={answering}
              accessibilityRole="button"
              accessibilityLabel={`Rechazar ${product.name}`}
            >
              <Text style={styles.rejectText}>Rechazar</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.button, styles.accept, (answering || pressed) && styles.dimmed]}
              onPress={() => onAccept(message)}
              disabled={answering}
              accessibilityRole="button"
              accessibilityLabel={`Aprobar ${product.name}`}
            >
              {answering ? (
                <ActivityIndicator color={colors.onAccent} size="small" />
              ) : (
                <Text style={styles.acceptText}>Aprobar</Text>
              )}
            </Pressable>
          </View>
        )}

        <Text style={styles.time}>
          {formatTime(message.createdAt)}
          {message.answeredAt ? ` · respondida ${formatTime(message.answeredAt)}` : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'flex-start', marginVertical: 6 },
  card: {
    width: '85%',
    maxWidth: 360,
    padding: 12,
    gap: 10,
    borderRadius: 14,
    borderBottomLeftRadius: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardAccepted: { borderColor: colors.successBorder },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, color: colors.accent },
  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  body: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  image: { width: 72, height: 72, borderRadius: 10, backgroundColor: colors.bg },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  imagePlaceholderText: { fontSize: 26, fontWeight: '700', color: colors.textMuted },
  info: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  price: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 4 },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  strike: { textDecorationLine: 'line-through', color: colors.textMuted },
  note: { fontSize: 12, color: colors.textMuted },
  actions: { flexDirection: 'row', gap: 8 },
  button: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accept: { backgroundColor: colors.accent },
  acceptText: { color: colors.onAccent, fontWeight: '700', fontSize: 15 },
  reject: { backgroundColor: colors.dangerSoft },
  rejectText: { color: colors.dangerText, fontWeight: '700', fontSize: 15 },
  dimmed: { opacity: 0.6 },
  time: { alignSelf: 'flex-end', fontSize: 11, color: colors.textMuted },
});
