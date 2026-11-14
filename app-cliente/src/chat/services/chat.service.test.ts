import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { DataSnapshot, DatabaseReference, TransactionResult } from 'firebase/database';
import { get, onValue, push, ref, runTransaction } from 'firebase/database';
import {
  ApiError,
  answerOffer,
  approveOffer,
  listenMessages,
  OfferAlreadyAnsweredError,
  parseMessage,
  parseMessages,
  rejectOffer,
  saveOrder,
  sendTextMessage,
} from './chat.service';

jest.mock('firebase/database', () => ({
  ref: jest.fn((_db: unknown, path: string) => ({ path })),
  push: jest.fn(),
  onValue: jest.fn(),
  get: jest.fn(),
  runTransaction: jest.fn(),
}));

jest.mock('../config/firebase', () => ({
  getDb: jest.fn(() => ({ fake: 'db' })),
}));

const pushMock = jest.mocked(push);
const onValueMock = jest.mocked(onValue);
const refMock = jest.mocked(ref);
const getMock = jest.mocked(get);
const runTransactionMock = jest.mocked(runTransaction);

const CHAT_ID = 'chat-demo-001';

const offerNode = {
  sender: 'comercio',
  type: 'product_offer',
  status: 'pending',
  product: { id: 'p-101', name: 'Bandeja paisa', price: 32000, currency: 'COP' },
  createdAt: 2000,
};

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.clearAllMocks();
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
    expect(console.warn).toHaveBeenCalledTimes(1);
  });
});

describe('sendTextMessage', () => {
  it('hace push en /chats/{chatId}/messages con el texto limpio', async () => {
    pushMock.mockResolvedValue({ key: '-Onuevo' } as unknown as ReturnType<typeof push>);

    const id = await sendTextMessage(CHAT_ID, 'cliente', '  Hola  ');

    expect(id).toBe('-Onuevo');
    expect(refMock).toHaveBeenCalledWith(expect.anything(), `chats/${CHAT_ID}/messages`);
    expect(pushMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: `chats/${CHAT_ID}/messages` }),
      { sender: 'cliente', type: 'text', text: 'Hola', createdAt: expect.any(Number) },
    );
  });

  it('rechaza mensajes vacíos sin tocar Firebase', async () => {
    await expect(sendTextMessage(CHAT_ID, 'cliente', '   ')).rejects.toThrow('vacío');
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('envuelve el error de Firebase con un mensaje claro', async () => {
    pushMock.mockRejectedValue(new Error('PERMISSION_DENIED'));

    await expect(sendTextMessage(CHAT_ID, 'cliente', 'Hola')).rejects.toThrow(
      'No se pudo enviar el mensaje: PERMISSION_DENIED',
    );
  });
});

describe('listenMessages', () => {
  it('entrega los mensajes parseados y devuelve la función de unsubscribe', () => {
    const unsubscribe = jest.fn();
    onValueMock.mockImplementation(((
      _ref: DatabaseReference,
      callback: (snapshot: DataSnapshot) => void,
    ) => {
      callback({ val: () => ({ '-Omsg1': offerNode }) } as DataSnapshot);
      return unsubscribe;
    }) as unknown as typeof onValue);

    const onMessages = jest.fn();
    const result = listenMessages(CHAT_ID, onMessages, jest.fn());

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
      return jest.fn();
    }) as unknown as typeof onValue);

    const onError = jest.fn();
    listenMessages(CHAT_ID, jest.fn(), onError);

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('permission_denied') }),
    );
  });
});

/* ───────────────────────── Respuesta a ofertas (E5) ───────────────────────── */

const API = 'http://localhost:3000';
const product = offerNode.product;

const createdOrder = {
  id: 'order-uuid-1',
  chatId: CHAT_ID,
  messageId: '-Omsg1',
  product,
  status: 'created',
  createdAt: 3000,
};

/** Simula el valor "del servidor" para runTransaction (undefined = aborta, como Firebase). */
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

function mockGet(value: unknown): void {
  getMock.mockResolvedValue({ val: () => value } as unknown as DataSnapshot);
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

const fetchMock = jest.fn<typeof fetch>();

beforeEach(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  pushMock.mockResolvedValue({ key: '-Oconfirm' } as unknown as Awaited<ReturnType<typeof push>>);
});

describe('answerOffer', () => {
  it('acepta una oferta pending guardando orderId y answeredAt', async () => {
    const server = mockServerValue(offerNode);

    await answerOffer(CHAT_ID, '-Omsg1', 'accepted', 'order-uuid-1');

    expect(refMock).toHaveBeenCalledWith(expect.anything(), `chats/${CHAT_ID}/messages/-Omsg1`);
    expect(server.written()).toEqual({
      ...offerNode,
      status: 'accepted',
      orderId: 'order-uuid-1',
      answeredAt: expect.any(Number),
    });
  });

  it('rechaza una oferta pending sin orderId', async () => {
    const server = mockServerValue(offerNode);

    await answerOffer(CHAT_ID, '-Omsg1', 'rejected');

    expect(server.written()).toEqual({ ...offerNode, status: 'rejected', answeredAt: expect.any(Number) });
  });

  it.each(['accepted', 'rejected'])('no sobreescribe una oferta ya %s', async (status) => {
    const answered = { ...offerNode, status };
    const server = mockServerValue(answered);

    await expect(answerOffer(CHAT_ID, '-Omsg1', 'rejected')).rejects.toBeInstanceOf(
      OfferAlreadyAnsweredError,
    );
    expect(server.written()).toEqual(answered);
  });

  it('falla si el comercio canceló (borró) la oferta', async () => {
    mockServerValue(null);

    await expect(answerOffer(CHAT_ID, '-Omsg1', 'rejected')).rejects.toThrow('ya no existe');
  });

  it('exige orderId para aceptar', async () => {
    await expect(answerOffer(CHAT_ID, '-Omsg1', 'accepted')).rejects.toThrow('id del pedido');
    expect(runTransactionMock).not.toHaveBeenCalled();
  });
});

describe('saveOrder', () => {
  const request = { chatId: CHAT_ID, messageId: '-Omsg1', product };

  it('hace POST /orders con JSON y devuelve el pedido', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, createdOrder));

    await expect(saveOrder(API, request)).resolves.toEqual(createdOrder);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API}/orders`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(request),
      }),
    );
  });

  it('lanza ApiError con el mensaje de la API si !response.ok', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, { statusCode: 400, message: ['product.price debe ser mayor que cero'] }),
    );

    const error = await saveOrder(API, request).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(400);
    expect((error as ApiError).message).toContain('product.price debe ser mayor que cero');
  });

  it('expone el orderId del 409', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(409, { statusCode: 409, message: 'ya existe', orderId: 'order-uuid-1' }),
    );

    await expect(saveOrder(API, request)).rejects.toMatchObject({ status: 409, orderId: 'order-uuid-1' });
  });

  it('da un mensaje claro si la API no responde', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    await expect(saveOrder(API, request)).rejects.toThrow('No se pudo conectar con la API');
  });

  it('rechaza una respuesta 2xx con formato inesperado', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { ok: true }));

    await expect(saveOrder(API, request)).rejects.toThrow('formato inesperado');
  });
});

describe('approveOffer', () => {
  it('guarda el pedido, marca accepted y publica order_accepted (en ese orden)', async () => {
    mockGet(offerNode);
    fetchMock.mockResolvedValue(jsonResponse(201, createdOrder));
    const server = mockServerValue(offerNode);

    const result = await approveOffer(API, CHAT_ID, '-Omsg1');

    expect(result).toEqual({ orderId: 'order-uuid-1', recovered: false });
    expect(server.written()).toMatchObject({ status: 'accepted', orderId: 'order-uuid-1' });
    expect(pushMock).toHaveBeenCalledWith(expect.anything(), {
      sender: 'cliente',
      type: 'order_accepted',
      orderId: 'order-uuid-1',
      offerMessageId: '-Omsg1',
      text: expect.stringContaining('Bandeja paisa'),
      createdAt: expect.any(Number),
    });
    const fetchOrder = fetchMock.mock.invocationCallOrder[0];
    const txOrder = runTransactionMock.mock.invocationCallOrder[0];
    expect(fetchOrder).toBeLessThan(txOrder);
  });

  it('si la API falla, NO cambia el estado de la oferta', async () => {
    mockGet(offerNode);
    fetchMock.mockResolvedValue(jsonResponse(500, { message: 'No se pudo guardar el pedido' }));

    await expect(approveOffer(API, CHAT_ID, '-Omsg1')).rejects.toBeInstanceOf(ApiError);
    expect(runTransactionMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('no llama a la API si la oferta ya fue respondida', async () => {
    mockGet({ ...offerNode, status: 'rejected' });

    await expect(approveOffer(API, CHAT_ID, '-Omsg1')).rejects.toBeInstanceOf(
      OfferAlreadyAnsweredError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('completa una aprobación interrumpida reutilizando el pedido del 409', async () => {
    mockGet(offerNode);
    fetchMock.mockResolvedValue(
      jsonResponse(409, { statusCode: 409, message: 'ya existe', orderId: 'order-previo' }),
    );
    const server = mockServerValue(offerNode);

    const result = await approveOffer(API, CHAT_ID, '-Omsg1');

    expect(result).toMatchObject({ orderId: 'order-previo', recovered: true });
    expect(server.written()).toMatchObject({ status: 'accepted', orderId: 'order-previo' });
  });

  it('si falla la confirmación en el chat, el pedido queda aceptado con aviso', async () => {
    mockGet(offerNode);
    fetchMock.mockResolvedValue(jsonResponse(201, createdOrder));
    mockServerValue(offerNode);
    pushMock.mockRejectedValue(new Error('offline'));

    const result = await approveOffer(API, CHAT_ID, '-Omsg1');

    expect(result.orderId).toBe('order-uuid-1');
    expect(result.warning).toContain('offline');
  });
});

describe('rejectOffer', () => {
  it('marca rejected sin llamar a la API', async () => {
    const server = mockServerValue(offerNode);

    await rejectOffer(CHAT_ID, '-Omsg1');

    expect(server.written()).toMatchObject({ status: 'rejected' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
