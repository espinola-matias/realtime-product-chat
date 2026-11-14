import type { Product } from './chat-message.interface';

/** Cuerpo de POST /orders. */
export interface CreateOrderRequest {
  chatId: string;
  messageId: string;
  product: Product;
}

/**
 * Resumen del pedido en Firebase: /chats/{chatId}/orders/{orderId}.
 * Índice para encontrar los pedidos sin recorrer todos los mensajes del chat.
 */
export interface ChatOrderSummary {
  /** N.º de pedido (UUID de la API); también es la key del nodo. */
  orderId: string;
  /** Oferta aceptada que originó el pedido (mensaje en /messages). */
  offerMessageId: string;
  product: Product;
  createdAt: number;
}

/** Pedido devuelto por la API. */
export interface Order {
  id: string;
  chatId: string;
  messageId: string;
  product: Product;
  status: 'created';
  createdAt: number;
}
