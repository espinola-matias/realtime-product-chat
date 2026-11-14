import {
  get,
  onValue,
  push,
  ref,
  runTransaction,
  set,
  type DataSnapshot,
  type Unsubscribe,
} from 'firebase/database';
import { getDb } from '../config/firebase';
import type {
  ChatMessage,
  ChatMessageData,
  OfferStatus,
  Product,
  ProductOfferMessage,
  Sender,
} from '../interfaces/chat-message.interface';
import type { CreateOrderRequest, Order } from '../interfaces/order.interface';
import { formatPrice } from './currency';

export const MAX_TEXT_LENGTH = 1000;
export const API_TIMEOUT_MS = 10_000;

const messagesPath = (chatId: string): string => `chats/${chatId}/messages`;
const messagePath = (chatId: string, messageId: string): string =>
  `${messagesPath(chatId)}/${messageId}`;

/** La oferta ya fue respondida (o eliminada) y no admite otra respuesta. */
export class OfferAlreadyAnsweredError extends Error {
  constructor(message = 'Esta oferta ya fue respondida') {
    super(message);
    this.name = 'OfferAlreadyAnsweredError';
  }
}

/** Error HTTP de la API, con el código y (si viene) el orderId del 409. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly orderId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/* ───────────────────────── Lectura segura de Firebase ───────────────────────── */

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isSender = (value: unknown): value is Sender =>
  value === 'cliente' || value === 'comercio';

const isOfferStatus = (value: unknown): value is OfferStatus =>
  value === 'pending' || value === 'accepted' || value === 'rejected';

function parseProduct(value: unknown): Product | null {
  if (!isRecord(value)) return null;
  const { id, name, price, currency, imageUrl } = value;
  if (!isString(id) || !isString(name) || !isFiniteNumber(price) || !isString(currency)) {
    return null;
  }
  return { id, name, price, currency, ...(isString(imageUrl) ? { imageUrl } : {}) };
}

/**
 * Convierte un nodo crudo de Firebase en un mensaje tipado.
 * Devuelve null si el nodo no respeta el contrato (no se confía en la BD).
 */
export function parseMessage(id: string, raw: unknown): ChatMessage | null {
  if (!isRecord(raw)) return null;
  const { sender, createdAt, type } = raw;
  if (!isSender(sender) || !isFiniteNumber(createdAt)) return null;

  switch (type) {
    case 'text':
      return isString(raw.text) ? { id, sender, createdAt, type, text: raw.text } : null;

    case 'product_offer': {
      const product = parseProduct(raw.product);
      if (sender !== 'comercio' || !isOfferStatus(raw.status) || !product) return null;
      return {
        id,
        sender,
        createdAt,
        type,
        status: raw.status,
        product,
        ...(isString(raw.orderId) ? { orderId: raw.orderId } : {}),
        ...(isFiniteNumber(raw.answeredAt) ? { answeredAt: raw.answeredAt } : {}),
      };
    }

    case 'order_accepted': {
      const { orderId, offerMessageId, text } = raw;
      if (sender !== 'cliente' || !isString(orderId) || !isString(offerMessageId) || !isString(text)) {
        return null;
      }
      return { id, sender, createdAt, type, orderId, offerMessageId, text };
    }

    default:
      return null;
  }
}

/** Objeto `{ [messageId]: datos }` de Firebase → arreglo tipado ordenado por fecha. */
export function parseMessages(value: unknown): ChatMessage[] {
  if (!isRecord(value)) return [];

  const messages: ChatMessage[] = [];
  for (const [id, raw] of Object.entries(value)) {
    const message = parseMessage(id, raw);
    if (message) {
      messages.push(message);
    } else {
      console.warn(`[chat] Mensaje ${id} ignorado: formato inválido`, raw);
    }
  }
  return messages.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

/* ───────────────────────────── Operaciones del chat ───────────────────────────── */

/**
 * Escribe un mensaje nuevo con su `id` dentro del nodo, igual a su key de Firebase.
 * `push()` sin valor solo genera la key (en local, sin red); luego `set()` escribe todo junto.
 */
async function pushMessage(chatId: string, message: ChatMessageData): Promise<string> {
  const newRef = push(ref(getDb(), messagesPath(chatId)));
  const key = newRef.key;
  if (!key) throw new Error('Firebase no generó el id del mensaje');
  const stored: ChatMessage = { ...message, id: key };
  await set(newRef, stored);
  return key;
}

/** Envía un mensaje de texto y devuelve su id (key de Firebase). */
export async function sendTextMessage(
  chatId: string,
  sender: Sender,
  text: string,
): Promise<string> {
  const clean = text.trim();
  if (!clean) throw new Error('El mensaje está vacío');
  if (clean.length > MAX_TEXT_LENGTH) {
    throw new Error(`El mensaje supera ${MAX_TEXT_LENGTH} caracteres`);
  }

  try {
    return await pushMessage(chatId, { sender, type: 'text', text: clean, createdAt: Date.now() });
  } catch (error: unknown) {
    throw new Error(`No se pudo enviar el mensaje: ${describeError(error)}`, { cause: error });
  }
}

/* ──────────────────────── Respuesta a ofertas (solo cliente) ──────────────────────── */

/** Lee el estado actual de una oferta desde el servidor (null si no existe o no es oferta). */
export async function getOffer(chatId: string, messageId: string): Promise<ProductOfferMessage | null> {
  let snapshot: DataSnapshot;
  try {
    snapshot = await get(ref(getDb(), messagePath(chatId, messageId)));
  } catch (error: unknown) {
    throw new Error(`No se pudo leer la oferta: ${describeError(error)}`, { cause: error });
  }
  const message = parseMessage(messageId, snapshot.val());
  return message?.type === 'product_offer' ? message : null;
}

const isPendingOffer = (value: unknown): value is UnknownRecord =>
  isRecord(value) && value.type === 'product_offer' && value.status === 'pending';

/**
 * Marca la oferta como accepted/rejected con una transacción:
 * solo escribe si sigue `pending`, así nunca se responde dos veces.
 */
export async function answerOffer(
  chatId: string,
  messageId: string,
  status: Exclude<OfferStatus, 'pending'>,
  orderId?: string,
): Promise<void> {
  if (status === 'accepted' && !orderId) {
    throw new Error('Para aceptar una oferta se necesita el id del pedido');
  }

  let result;
  try {
    result = await runTransaction(ref(getDb(), messagePath(chatId, messageId)), (current: unknown) => {
      // null = caché local vacía: se devuelve tal cual para que Firebase reintente con el valor real.
      if (current === null) return null;
      if (!isPendingOffer(current)) return undefined; // aborta: ya respondida
      return {
        ...current,
        status,
        answeredAt: Date.now(),
        ...(status === 'accepted' && orderId ? { orderId } : {}),
      };
    });
  } catch (error: unknown) {
    throw new Error(`No se pudo actualizar la oferta: ${describeError(error)}`, { cause: error });
  }

  if (!result.committed) throw new OfferAlreadyAnsweredError();
  if (!result.snapshot.exists()) throw new OfferAlreadyAnsweredError('La oferta ya no existe (el comercio la canceló)');
}

/** Texto de la confirmación: nombre y precio, para distinguir ofertas del mismo producto. */
export function orderAcceptedText(product: Product): string {
  return `✅ Pedido confirmado: ${product.name} · ${formatPrice(product.price, product.currency)}`;
}

/**
 * Publica en el chat la confirmación del pedido (mensaje `order_accepted`).
 * El `orderId` (UUID de la API) viaja en su propio campo y ambas apps lo muestran
 * como “N.º de pedido”, así se sabe exactamente qué oferta se aceptó.
 */
export async function sendOrderAccepted(
  chatId: string,
  orderId: string,
  offerMessageId: string,
  product: Product,
): Promise<string> {
  try {
    return await pushMessage(chatId, {
      sender: 'cliente',
      type: 'order_accepted',
      orderId,
      offerMessageId,
      text: orderAcceptedText(product),
      createdAt: Date.now(),
    });
  } catch (error: unknown) {
    throw new Error(`No se pudo publicar la confirmación: ${describeError(error)}`, { cause: error });
  }
}

/* ────────────────────────────────── API REST ────────────────────────────────── */

function isOrder(value: unknown): value is Order {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.chatId) &&
    isString(value.messageId) &&
    value.status === 'created' &&
    isFiniteNumber(value.createdAt) &&
    parseProduct(value.product) !== null
  );
}

/** Extrae el mensaje legible de un error de NestJS ({ message: string | string[] }). */
function apiErrorMessage(body: unknown, status: number): string {
  if (isRecord(body)) {
    const { message } = body;
    if (isString(message)) return message;
    if (Array.isArray(message)) return message.filter(isString).join('. ');
  }
  return `La API respondió ${status}`;
}

/** Guarda el pedido en la API (POST /orders). Lanza ApiError si la respuesta no es 2xx. */
export async function saveOrder(apiBase: string, order: CreateOrderRequest): Promise<Order> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${apiBase}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(order),
      signal: controller.signal,
    });
  } catch (error: unknown) {
    const reason = controller.signal.aborted ? 'tiempo de espera agotado' : describeError(error);
    throw new Error(
      `No se pudo conectar con la API (${apiBase}): ${reason}. Verifique que esté encendida y que EXPO_PUBLIC_API_URL sea correcta.`,
      { cause: error },
    );
  } finally {
    clearTimeout(timeout);
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const orderId = isRecord(body) && isString(body.orderId) ? body.orderId : undefined;
    throw new ApiError(`No se pudo guardar el pedido: ${apiErrorMessage(body, response.status)}`, response.status, orderId);
  }
  if (!isOrder(body)) {
    throw new ApiError('La API devolvió un pedido con formato inesperado', response.status);
  }
  return body;
}

/* ───────────────────────────── Flujos Aprobar / Rechazar ───────────────────────────── */

export interface ApproveResult {
  orderId: string;
  /** true si el pedido ya existía (aprobación previa interrumpida) y se reutilizó. */
  recovered: boolean;
  /** Aviso no bloqueante: el pedido quedó aceptado pero falló el mensaje de confirmación. */
  warning?: string;
}

/**
 * Aprobar una oferta, en este orden:
 * 1. Verifica en el servidor que siga `pending`.
 * 2. POST /orders. Si falla, la oferta NO cambia de estado.
 *    (409 con orderId = el pedido ya existía: se reutiliza para completar la aprobación).
 * 3. Transacción → `accepted` con el orderId.
 * 4. Mensaje `order_accepted` en el chat (si falla, solo se avisa).
 */
export async function approveOffer(
  apiBase: string,
  chatId: string,
  messageId: string,
): Promise<ApproveResult> {
  const offer = await getOffer(chatId, messageId);
  if (!offer) throw new OfferAlreadyAnsweredError('La oferta ya no existe (el comercio la canceló)');
  if (offer.status !== 'pending') throw new OfferAlreadyAnsweredError();

  let orderId: string;
  let recovered = false;
  try {
    orderId = (await saveOrder(apiBase, { chatId, messageId, product: offer.product })).id;
  } catch (error: unknown) {
    if (error instanceof ApiError && error.status === 409 && error.orderId) {
      orderId = error.orderId;
      recovered = true;
    } else {
      throw error;
    }
  }

  await answerOffer(chatId, messageId, 'accepted', orderId);

  try {
    await sendOrderAccepted(chatId, orderId, messageId, offer.product);
    return { orderId, recovered };
  } catch (error: unknown) {
    return { orderId, recovered, warning: describeError(error) };
  }
}

/** Rechazar una oferta: solo actualiza Firebase, no llama a la API. */
export function rejectOffer(chatId: string, messageId: string): Promise<void> {
  return answerOffer(chatId, messageId, 'rejected');
}

/**
 * Escucha /chats/{chatId}/messages en tiempo real.
 * Devuelve la función para dejar de escuchar (usar en el cleanup del useEffect).
 */
export function listenMessages(
  chatId: string,
  onMessages: (messages: ChatMessage[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onValue(
    ref(getDb(), messagesPath(chatId)),
    (snapshot: DataSnapshot) => onMessages(parseMessages(snapshot.val())),
    (error: Error) =>
      onError(new Error(`Se perdió la conexión con el chat: ${error.message}`, { cause: error })),
  );
}

/** Estado de conexión del cliente con Firebase (`.info/connected`). */
export function listenConnection(onChange: (connected: boolean) => void): Unsubscribe {
  return onValue(ref(getDb(), '.info/connected'), (snapshot: DataSnapshot) =>
    onChange(snapshot.val() === true),
  );
}
