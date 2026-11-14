import type { Product } from './chat-message.interface';

/** Cuerpo de POST /orders. */
export interface CreateOrderRequest {
  chatId: string;
  messageId: string;
  product: Product;
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
