import type { DataSnapshot, DatabaseReference } from 'firebase/database';
import { onValue, push, ref } from 'firebase/database';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  listenMessages,
  parseMessage,
  parseMessages,
  sendTextMessage,
} from './chat.service';

vi.mock('firebase/database', () => ({
  ref: vi.fn((_db: unknown, path: string) => ({ path })),
  push: vi.fn(),
  onValue: vi.fn(),
}));

vi.mock('../config/firebase', () => ({
  getDb: vi.fn(() => ({ fake: 'db' })),
}));

const pushMock = vi.mocked(push);
const onValueMock = vi.mocked(onValue);
const refMock = vi.mocked(ref);

const CHAT_ID = 'chat-demo-001';

const offerNode = {
  sender: 'comercio',
  type: 'product_offer',
  status: 'pending',
  product: { id: 'p-101', name: 'Bandeja paisa', price: 32000, currency: 'COP' },
  createdAt: 2000,
};

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('parseMessage', () => {
  it('lee un mensaje de texto y le agrega el id', () => {
    expect(
      parseMessage('-Omsg0', { sender: 'cliente', type: 'text', text: 'Hola', createdAt: 1 }),
    ).toEqual({ id: '-Omsg0', sender: 'cliente', type: 'text', text: 'Hola', createdAt: 1 });
  });

  it('lee una oferta de producto', () => {
    expect(parseMessage('-Omsg1', offerNode)).toEqual({ id: '-Omsg1', ...offerNode });
  });

  it.each([
    ['no es objeto', 'hola'],
    ['sender inválido', { sender: 'admin', type: 'text', text: 'x', createdAt: 1 }],
    ['sin createdAt', { sender: 'cliente', type: 'text', text: 'x' }],
    ['tipo desconocido', { sender: 'cliente', type: 'audio', createdAt: 1 }],
    ['texto sin text', { sender: 'cliente', type: 'text', createdAt: 1 }],
    ['oferta enviada por el cliente', { ...offerNode, sender: 'cliente' }],
    ['oferta con estado inválido', { ...offerNode, status: 'cancelled' }],
    ['oferta sin precio', { ...offerNode, product: { id: 'p', name: 'n', currency: 'COP' } }],
  ])('descarta el nodo si %s', (_caso, raw) => {
    expect(parseMessage('-Ox', raw)).toBeNull();
  });
});

describe('parseMessages', () => {
  it('devuelve [] si no hay mensajes (snapshot null)', () => {
    expect(parseMessages(null)).toEqual([]);
  });

  it('ordena por createdAt y omite nodos inválidos', () => {
    const result = parseMessages({
      b: { sender: 'comercio', type: 'text', text: 'segundo', createdAt: 20 },
      a: { sender: 'cliente', type: 'text', text: 'primero', createdAt: 10 },
      roto: { foo: 'bar' },
    });

    expect(result.map((m) => m.id)).toEqual(['a', 'b']);
    expect(console.warn).toHaveBeenCalledOnce();
  });
});

describe('sendTextMessage', () => {
  it('hace push en /chats/{chatId}/messages con el texto limpio', async () => {
    pushMock.mockResolvedValue({ key: '-Onuevo' } as unknown as ReturnType<typeof push>);

    const id = await sendTextMessage(CHAT_ID, 'comercio', '  Hola  ');

    expect(id).toBe('-Onuevo');
    expect(refMock).toHaveBeenCalledWith(expect.anything(), `chats/${CHAT_ID}/messages`);
    expect(pushMock).toHaveBeenCalledWith(
      { path: `chats/${CHAT_ID}/messages` },
      { sender: 'comercio', type: 'text', text: 'Hola', createdAt: expect.any(Number) },
    );
  });

  it('rechaza mensajes vacíos sin tocar Firebase', async () => {
    await expect(sendTextMessage(CHAT_ID, 'comercio', '   ')).rejects.toThrow('vacío');
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('envuelve el error de Firebase con un mensaje claro', async () => {
    pushMock.mockRejectedValue(new Error('PERMISSION_DENIED'));

    await expect(sendTextMessage(CHAT_ID, 'comercio', 'Hola')).rejects.toThrow(
      'No se pudo enviar el mensaje: PERMISSION_DENIED',
    );
  });
});

describe('listenMessages', () => {
  it('entrega los mensajes parseados y devuelve la función de unsubscribe', () => {
    const unsubscribe = vi.fn();
    onValueMock.mockImplementation(((
      _ref: DatabaseReference,
      callback: (snapshot: DataSnapshot) => void,
    ) => {
      callback({ val: () => ({ '-Omsg1': offerNode }) } as DataSnapshot);
      return unsubscribe;
    }) as unknown as typeof onValue);

    const onMessages = vi.fn();
    const result = listenMessages(CHAT_ID, onMessages, vi.fn());

    expect(onMessages).toHaveBeenCalledWith([{ id: '-Omsg1', ...offerNode }]);
    expect(result).toBe(unsubscribe);
  });

  it('notifica el error si Firebase cancela el listener', () => {
    onValueMock.mockImplementation(((
      _ref: DatabaseReference,
      _callback: unknown,
      cancel: (error: Error) => void,
    ) => {
      cancel(new Error('permission_denied'));
      return vi.fn();
    }) as unknown as typeof onValue);

    const onError = vi.fn();
    listenMessages(CHAT_ID, vi.fn(), onError);

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('permission_denied') }),
    );
  });
});
