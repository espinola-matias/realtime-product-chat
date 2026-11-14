export type OrderStatus = 'created';

export interface OrderProduct {
  id: string;
  name: string;
  price: number;
  currency: string;
  imageUrl?: string;
}

export interface Order {
  id: string;
  chatId: string;
  messageId: string;
  product: OrderProduct;
  status: OrderStatus;
  createdAt: number;
}
