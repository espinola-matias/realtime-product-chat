import { useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { OfferStatus, ProductOfferMessage } from '../interfaces/chat-message.interface';
import { formatPrice } from '../services/currency';
import { colors, fonts, radius } from './theme';

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
          <View style={styles.note}>
            <Text style={styles.noteLabel}>N.º DE PEDIDO</Text>
            <Text style={styles.noteValue} selectable>
              {message.orderId}
            </Text>
          </View>
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
                <ActivityIndicator color={colors.onBrand} size="small" />
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
    width: '88%',
    maxWidth: 380,
    padding: 14,
    gap: 12,
    borderRadius: radius.lg,
    borderBottomLeftRadius: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    shadowColor: '#7a3a10',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardAccepted: { borderColor: colors.successBorder },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  kicker: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.6, color: colors.brandText },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { fontFamily: fonts.semibold, fontSize: 11 },
  body: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  image: { width: 76, height: 76, borderRadius: radius.md, backgroundColor: colors.bg },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandBright },
  imagePlaceholderText: { fontFamily: fonts.displayBold, fontSize: 28, color: colors.text },
  info: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.display, fontSize: 16, color: colors.text },
  price: { fontFamily: fonts.displayBold, fontSize: 19, color: colors.brandTextLarge, marginTop: 4 },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  strike: { textDecorationLine: 'line-through', color: colors.textMuted },
  note: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.successSoft,
    gap: 2,
  },
  noteLabel: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.6, color: colors.successText },
  noteValue: {
    fontSize: 12,
    color: colors.text,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  actions: { flexDirection: 'row', gap: 10 },
  button: {
    flex: 1,
    height: 46,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accept: { backgroundColor: colors.brand, borderWidth: 1, borderColor: colors.brandPressed },
  acceptText: { fontFamily: fonts.bold, color: colors.onBrand, fontSize: 15 },
  reject: { backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.dangerBorder },
  rejectText: { fontFamily: fonts.bold, color: colors.dangerText, fontSize: 15 },
  dimmed: { opacity: 0.6 },
  time: { alignSelf: 'flex-end', fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted },
});
