import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { readFile, writeFile } from 'fs/promises';
import { CreateOrderDto } from '../dto/create-order.dto';
import { Order } from '../interfaces/order.interface';
import { OrdersService } from './orders.service';

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
}));

const readFileMock = readFile as jest.MockedFunction<typeof readFile>;
const writeFileMock = writeFile as jest.MockedFunction<typeof writeFile>;

const CHAT_ID = 'chat-demo-001';

function buildDto(overrides: Partial<CreateOrderDto> = {}): CreateOrderDto {
  return {
    chatId: CHAT_ID,
    messageId: '-Omsg1',
    product: {
      id: 'p-101',
      name: 'Bandeja paisa',
      price: 32000,
      currency: 'COP',
      imageUrl: 'https://ejemplo.com/bandeja.jpg',
    },
    ...overrides,
  };
}

function enoent(): NodeJS.ErrnoException {
  const error: NodeJS.ErrnoException = new Error('no existe');
  error.code = 'ENOENT';
  return error;
}

async function createService(
  env: Record<string, string | undefined> = { CHAT_ID },
): Promise<OrdersService> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      OrdersService,
      {
        provide: ConfigService,
        useValue: { get: (key: string): string | undefined => env[key] },
      },
    ],
  }).compile();

  const service = moduleRef.get(OrdersService);
  await service.onModuleInit();
  return service;
}

describe('OrdersService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    // Silencia los logs esperados (errores simulados) en la salida de Jest.
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    readFileMock.mockRejectedValue(enoent());
    writeFileMock.mockResolvedValue(undefined);
  });

  describe('create', () => {
    it('crea el pedido con id, status created y createdAt', async () => {
      const service = await createService();

      const order = await service.create(buildDto());

      expect(order).toEqual<Order>({
        id: expect.any(String) as string,
        chatId: CHAT_ID,
        messageId: '-Omsg1',
        product: buildDto().product,
        status: 'created',
        createdAt: expect.any(Number) as number,
      });
    });

    it('persiste el pedido en el archivo como JSON', async () => {
      const service = await createService();

      const order = await service.create(buildDto());

      expect(writeFileMock).toHaveBeenCalledTimes(1);
      const [, content] = writeFileMock.mock.calls[0];
      expect(JSON.parse(String(content))).toEqual([order]);
    });

    it('lanza 409 si la oferta ya tiene un pedido (no se aprueba dos veces)', async () => {
      const service = await createService();
      await service.create(buildDto());

      await expect(service.create(buildDto())).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(writeFileMock).toHaveBeenCalledTimes(1);
    });

    it('lanza 409 aunque los dos POST lleguen al mismo tiempo', async () => {
      const service = await createService();

      const results = await Promise.allSettled([
        service.create(buildDto()),
        service.create(buildDto()),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    });

    it('lanza 400 si el chatId no es el configurado', async () => {
      const service = await createService();

      await expect(
        service.create(buildDto({ chatId: 'otro-chat' })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('acepta cualquier chatId si CHAT_ID no está configurado', async () => {
      const service = await createService({});

      await expect(
        service.create(buildDto({ chatId: 'otro-chat' })),
      ).resolves.toMatchObject({ chatId: 'otro-chat' });
    });

    it('lanza 500 y no deja el pedido en memoria si falla la escritura', async () => {
      const service = await createService();
      writeFileMock.mockRejectedValueOnce(new Error('disco lleno'));

      await expect(service.create(buildDto())).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );

      // Al reintentar ya no hay conflicto: el pedido fallido se revirtió.
      await expect(service.create(buildDto())).resolves.toMatchObject({
        messageId: '-Omsg1',
      });
    });
  });

  describe('findOne', () => {
    it('devuelve el pedido creado', async () => {
      const service = await createService();
      const order = await service.create(buildDto());

      expect(service.findOne(order.id)).toEqual(order);
    });

    it('lanza 404 si el pedido no existe', async () => {
      const service = await createService();

      expect(() => service.findOne('no-existe')).toThrow(NotFoundException);
    });
  });

  describe('carga inicial', () => {
    it('lee los pedidos guardados en el archivo', async () => {
      const saved: Order = {
        id: 'b3c1f0e2-0000-4000-8000-000000000001',
        chatId: CHAT_ID,
        messageId: '-Oprevio',
        product: { id: 'p-1', name: 'Arepa', price: 5000, currency: 'COP' },
        status: 'created',
        createdAt: 1731024000000,
      };
      readFileMock.mockResolvedValue(JSON.stringify([saved]));

      const service = await createService();

      expect(service.findOne(saved.id)).toEqual(saved);
      await expect(
        service.create(buildDto({ messageId: '-Oprevio' })),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('arranca vacío si el archivo está vacío', async () => {
      readFileMock.mockResolvedValue('');

      const service = await createService();

      expect(() => service.findOne('x')).toThrow(NotFoundException);
    });

    it('falla al arrancar si el archivo no es JSON válido (no lo sobreescribe)', async () => {
      readFileMock.mockResolvedValue('{ roto');

      await expect(createService()).rejects.toThrow('no contiene JSON válido');
      expect(writeFileMock).not.toHaveBeenCalled();
    });

    it('falla al arrancar si el archivo no es un arreglo', async () => {
      readFileMock.mockResolvedValue('{"a":1}');

      await expect(createService()).rejects.toThrow('arreglo de pedidos');
    });

    it('falla al arrancar con un mensaje claro si no puede leer el archivo', async () => {
      const denied: NodeJS.ErrnoException = new Error('permiso denegado');
      denied.code = 'EACCES';
      readFileMock.mockRejectedValue(denied);

      await expect(createService()).rejects.toThrow('No se pudo leer');
      await expect(createService()).rejects.toThrow('permiso denegado');
    });
  });
});
