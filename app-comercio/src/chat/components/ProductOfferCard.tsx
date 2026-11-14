import { useState } from 'react';
import type { OfferStatus, ProductOfferMessage } from '../interfaces/chat-message.interface';
import './ProductOfferCard.css';

interface ProductOfferCardProps {
  message: ProductOfferMessage;
  /** Corregir la oferta (solo se muestra si sigue pending). */
  onEdit?: (message: ProductOfferMessage) => void;
  /** Cancelar la oferta (solo se muestra si sigue pending). */
  onCancel?: (message: ProductOfferMessage) => void;
  /** Deshabilita las acciones mientras se procesa una corrección/cancelación. */
  busy?: boolean;
}

const statusLabel: Record<OfferStatus, string> = {
  pending: 'Pendiente',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
};

const timeFormat = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' });

function formatPrice(price: number, currency: string): string {
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return `${currency} ${price}`;
  }
}

function ProductImage({ name, imageUrl }: { name: string; imageUrl?: string }) {
  const [failed, setFailed] = useState(false);

  if (!imageUrl || failed) {
    return (
      <div className="offer__image offer__image--placeholder" aria-hidden="true">
        {name.charAt(0).toUpperCase() || '?'}
      </div>
    );
  }
  return (
    <img className="offer__image" src={imageUrl} alt={name} loading="lazy" onError={() => setFailed(true)} />
  );
}

/**
 * Oferta vista por el comercio: solo muestra el estado.
 * No tiene botones de respuesta (Aprobar/Rechazar es exclusivo del cliente).
 */
export function ProductOfferCard({ message, onEdit, onCancel, busy = false }: ProductOfferCardProps) {
  const { product, status } = message;
  const isPending = status === 'pending';

  return (
    <div className="offer-row">
      <article className={`offer offer--${status}`} aria-label={`Oferta: ${product.name}`}>
        <header className="offer__header">
          <span className="offer__kicker">Oferta enviada</span>
          <span className={`offer__badge offer__badge--${status}`}>{statusLabel[status]}</span>
        </header>

        <div className="offer__body">
          <ProductImage name={product.name} imageUrl={product.imageUrl} />
          <div className="offer__info">
            <h3 className="offer__name">{product.name}</h3>
            <p className="offer__price">{formatPrice(product.price, product.currency)}</p>
            <p className="offer__meta">Ref. {product.id}</p>
          </div>
        </div>

        {status === 'accepted' && message.orderId && (
          <p className="offer__note">
            Pedido <code>{message.orderId}</code>
          </p>
        )}
        {isPending && <p className="offer__note">Esperando respuesta del cliente…</p>}

        {isPending && (onEdit || onCancel) && (
          <div className="offer__actions">
            {onEdit && (
              <button type="button" className="button button--small" onClick={() => onEdit(message)} disabled={busy}>
                Corregir
              </button>
            )}
            {onCancel && (
              <button
                type="button"
                className="button button--small button--danger"
                onClick={() => onCancel(message)}
                disabled={busy}
              >
                Cancelar oferta
              </button>
            )}
          </div>
        )}

        <time className="offer__time" dateTime={new Date(message.createdAt).toISOString()}>
          {timeFormat.format(message.createdAt)}
          {message.answeredAt ? ` · respondida ${timeFormat.format(message.answeredAt)}` : ''}
        </time>
      </article>
    </div>
  );
}
