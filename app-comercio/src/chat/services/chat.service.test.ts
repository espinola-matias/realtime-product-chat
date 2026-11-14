import type { DataSnapshot, DatabaseReference, TransactionResult } from 'firebase/database';
import { onValue, push, ref, runTransaction } from 'firebase/database';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../interfaces/chat-message.interface';
import {
  cancelOffer,
  listenConnection,
  listenMessages,
  OfferNotEditableError,
  parseMessage,
  parseMessages,
  sendProductOffer,
  sendTextMessage,
  updateOffer,
  validateProduct,
} from './chat.service';

vi.mock('firebase/database', () => ({
  ref: vi.fn((_db: unknown, path: string) => ({ path })),
  push: vi.fn(),
  onValue: vi.fn(),
  runTransaction: vi.fn(),
}));

vi.mock('../config/firebase', () => ({
  getDb: vi.fn(() => ({ fake: 'db' })),
}));

const pushMock = vi.mocked(push);
const onValueMock = vi.mocked(onValue);
const refMock = vi.mocked(ref);
const runTransactionMock = vi.mocked(runTransaction);

/**
 * Simula runTransaction contra un valor "del servidor": ejecuta la función de
 * actualización y devuelve committed=false si aborta (undefined), como Firebase.
 */
function mockServerValue(serverValue: unknown): { written: () => unknown } {
  let written: unknown = serverValue;
  runTransactionMock.mockImplementation((async (
    _ref: DatabaseReference,
    update: (current: unknown) => unknown,
  ) => {
    const next = update(serverValue);
    const committed = next !== undefined;
    if (committed) written = next;
    const finalValue = committed ? next : serverValue;
    return {
      committed,
      snapshot: { exists: () => finalValue !== null, val: () => finalValue },
    } as unknown as TransactionResult;
  }) as unknown as typeof runTransaction);
  return { written: () => written };
}

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

const product: Product = {
  id: 'p-101',
  name: 'Bandeja paisa',
  price: 32000,
  currency: 'COP',
  imageUrl: 'https://ejemplo.com/bandeja.jpg',
};

describe('validateProduct', () => {
  it('acepta un producto válido', () => {
    expect(validateProduct(product)).toEqual([]);
  });

  it.each<[string, Partial<Product>]>([
    ['id vacío', { id: ' ' }],
    ['nombre vacío', { name: '' }],
    ['precio cero', { price: 0 }],
    ['precio negativo', { price: -5 }],
    ['precio NaN', { price: Number.NaN }],
    ['moneda inválida', { currency: 'pesos' }],
    ['imagen sin http', { imageUrl: 'ftp://x/y.jpg' }],
  ])('rechaza %s', (_caso, override) => {
    expect(validateProduct({ ...product, ...override })).toHaveLength(1);
  });
});

describe('sendProductOffer', () => {
  it('envía type product_offer, sender comercio y status pending', async () => {
    pushMock.mockResolvedValue({ key: '-Ooferta' } as unknown as ReturnType<typeof push>);

    const id = await sendProductOffer(CHAT_ID, { ...product, name: '  Bandeja paisa ' });

    expect(id).toBe('-Ooferta');
    expect(pushMock).toHaveBeenCalledWith(
      { path: `chats/${CHAT_ID}/messages` },
      {
        sender: 'comercio',
        type: 'product_offer',
        status: 'pending',
        product,
        createdAt: expect.any(Number),
      },
    );
  });

  it('no escribe en Firebase si el producto es inválido', async () => {
    await expect(sendProductOffer(CHAT_ID, { ...product, price: 0 })).rejects.toThrow(
      'mayor que cero',
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('omite imageUrl vacía', async () => {
    pushMock.mockResolvedValue({ key: '-Ox' } as unknown as ReturnType<typeof push>);

    await sendProductOffer(CHAT_ID, { ...product, imageUrl: '   ' });

    const [, data] = pushMock.mock.calls[0];
    expect(data).toMatchObject({ product: { id: 'p-101' } });
    expect((data as { product: Product }).product).not.toHaveProperty('imageUrl');
  });
});

describe('updateOffer', () => {
  const corrected: Product = { ...product, price: 30000 };

  it('corrige el producto si la oferta sigue pending', async () => {
    const server = mockServerValue(offerNode);

    await updateOffer(CHAT_ID, '-Omsg1', corrected);

    expect(refMock).toHaveBeenCalledWith(expect.anything(), `chats/${CHAT_ID}/messages/-Omsg1`);
    expect(server.written()).toEqual({ ...offerNode, product: corrected });
  });

  it('no toca una oferta ya respondida', async () => {
    const accepted = { ...offerNode, status: 'accepted', orderId: 'o-1' };
    const server = mockServerValue(accepted);

    await expect(updateOffer(CHAT_ID, '-Omsg1', corrected)).rejects.toBeInstanceOf(
      OfferNotEditableError,
    );
    expect(server.written()).toEqual(accepted);
  });

  it('falla si la oferta ya no existe', async () => {
    mockServerValue(null);

    await expect(updateOffer(CHAT_ID, '-Omsg1', corrected)).rejects.toThrow('ya no existe');
  });
});

describe('cancelOffer', () => {
  it('borra la oferta si sigue pending', async () => {
    const server = mockServerValue(offerNode);

    await cancelOffer(CHAT_ID, '-Omsg1');

    expect(server.written()).toBeNull();
  });

  it('no borra una oferta ya respondida', async () => {
    const rejected = { ...offerNode, status: 'rejected' };
    const server = mockServerValue(rejected);

    await expect(cancelOffer(CHAT_ID, '-Omsg1')).rejects.toBeInstanceOf(OfferNotEditableError);
    expect(server.written()).toEqual(rejected);
  });

  it('no borra un mensaje que no es oferta', async () => {
    const text = { sender: 'cliente', type: 'text', text: 'hola', createdAt: 1 };
    mockServerValue(text);

    await expect(cancelOffer(CHAT_ID, '-Omsg0')).rejects.toBeInstanceOf(OfferNotEditableError);
  });
});

/* ───────────────────────── Cobertura adicional (E6) ───────────────────────── */

describe('parseMessage · order_accepted', () => {
  const confirmation = {
    sender: 'cliente',
    type: 'order_accepted',
    orderId: 'order-uuid-1',
    offerMessageId: '-Omsg1',
    text: '✅ Pedido confirmado: Bandeja paisa',
    createdAt: 4000,
  };

  it('lee la confirmación del pedido', () => {
    expect(parseMessage('-Oconf', confirmation)).toEqual({ id: '-Oconf', ...confirmation });
  });

  it('descarta una confirmación enviada por el comercio', () => {
    expect(parseMessage('-Oconf', { ...confirmation, sender: 'comercio' })).toBeNull();
  });

  it('descarta una confirmación sin orderId', () => {
    const { orderId: _omit, ...withoutOrder } = confirmation;
    expect(parseMessage('-Oconf', withoutOrder)).toBeNull();
  });

  it('conserva orderId y answeredAt de una oferta aceptada', () => {
    const accepted = { ...offerNode, status: 'accepted', orderId: 'order-uuid-1', answeredAt: 5000 };
    expect(parseMessage('-Omsg1', accepted)).toEqual({ id: '-Omsg1', ...accepted });
  });
});

describe('listenConnection', () => {
  it('escucha .info/connected y entrega un booleano', () => {
    onValueMock.mockImplementation(((
      _ref: DatabaseReference,
      callback: (snapshot: DataSnapshot) => void,
    ) => {
      callback({ val: () => true } as unknown as DataSnapshot);
      callback({ val: () => null } as unknown as DataSnapshot);
      return () => undefined;
    }) as unknown as typeof onValue);

    const onChange = vi.fn();
    listenConnection(onChange);

    expect(refMock).toHaveBeenCalledWith(expect.anything(), '.info/connected');
    expect(onChange).toHaveBeenNthCalledWith(1, true);
    expect(onChange).toHaveBeenNthCalledWith(2, false);
  });
});
