export type Sender = 'cliente' | 'comercio';
export type OfferStatus = 'pending' | 'accepted' | 'rejected';

export interface Product {
  id: string;
  name: string;
  /** Mayor que cero. */
  price: number;
  /** Código ISO de 3 letras, ej. 'COP'. */
  currency: string;
  imageUrl?: string;
}

interface BaseMessage {
  /** Key generada por push(). También se guarda dentro del nodo como `id`; al leer manda la key. */
  id: string;
  sender: Sender;
  /** Date.now() al enviar. */
  createdAt: number;
}

export interface TextMessage extends BaseMessage {
  type: 'text';
  text: string;
}

export interface ProductOfferMessage extends BaseMessage {
  sender: 'comercio';
  type: 'product_offer';
  status: OfferStatus;
  product: Product;
  /** Se completa al aceptar. */
  orderId?: string;
  answeredAt?: number;
}

/** Confirmación que publica el cliente al aprobar una oferta. */
export interface OrderAcceptedMessage extends BaseMessage {
  sender: 'cliente';
  type: 'order_accepted';
  orderId: string;
  offerMessageId: string;
  text: string;
}

export type ChatMessage = TextMessage | ProductOfferMessage | OrderAcceptedMessage;
export type ChatMessageType = ChatMessage['type'];

/** Omit distribuido: Omit<Unión, K> a secas colapsaría a las claves comunes. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** Datos del mensaje antes de tener key (pushMessage agrega el `id` = key al escribir). */
export type ChatMessageData = DistributiveOmit<ChatMessage, 'id'>;
