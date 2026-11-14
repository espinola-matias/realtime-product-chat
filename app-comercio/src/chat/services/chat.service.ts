import {
  onValue,
  push,
  ref,
  type DataSnapshot,
  type Unsubscribe,
} from 'firebase/database';
import { getDb } from '../config/firebase';
import type {
  ChatMessage,
  ChatMessageData,
  OfferStatus,
  Product,
  Sender,
} from '../interfaces/chat-message.interface';

export const MAX_TEXT_LENGTH = 1000;

const messagesPath = (chatId: string): string => `chats/${chatId}/messages`;

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

async function pushMessage(chatId: string, message: ChatMessageData): Promise<string> {
  const key = (await push(ref(getDb(), messagesPath(chatId)), message)).key;
  if (!key) throw new Error('Firebase no devolvió el id del mensaje');
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
