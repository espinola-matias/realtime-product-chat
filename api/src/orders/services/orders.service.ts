import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { CreateOrderDto } from '../dto/create-order.dto';
import { Order } from '../interfaces/order.interface';

const DEFAULT_ORDERS_FILE = './orders.json';

/**
 * Chequeo estructural (no `instanceof Error`): los errores de `fs` pueden venir
 * de otro contexto (p. ej. el sandbox de Jest) y fallar el `instanceof`.
 */
function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error;
}

function errorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String(error.message);
  }
  return String(error);
}

@Injectable()
export class OrdersService implements OnModuleInit {
  private readonly logger = new Logger(OrdersService.name);
  private readonly filePath: string;
  private readonly expectedChatId: string | undefined;
  private orders: Order[] = [];
  /** Serializa las escrituras para que dos POST simultáneos no pisen el archivo. */
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(config: ConfigService) {
    this.filePath = resolve(
      config.get<string>('ORDERS_FILE') || DEFAULT_ORDERS_FILE,
    );
    const chatId = config.get<string>('CHAT_ID')?.trim();
    this.expectedChatId = chatId ? chatId : undefined;
  }

  async onModuleInit(): Promise<void> {
    this.orders = await this.loadOrders();
    this.logger.log(
      `${this.orders.length} pedido(s) cargado(s) desde ${this.filePath}`,
    );
  }

  async create(dto: CreateOrderDto): Promise<Order> {
    if (this.expectedChatId && dto.chatId !== this.expectedChatId) {
      throw new BadRequestException(
        `chatId "${dto.chatId}" no corresponde al chat configurado`,
      );
    }

    // Comprobación y alta en el mismo tick: ningún otro request se cuela en medio.
    const existing = this.orders.find((o) => o.messageId === dto.messageId);
    if (existing) {
      // Se incluye orderId para que el cliente pueda completar una aprobación
      // interrumpida (pedido guardado pero Firebase sin actualizar) sin duplicar.
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: `La oferta ${dto.messageId} ya tiene el pedido ${existing.id}`,
        orderId: existing.id,
      });
    }

    const order: Order = {
      id: randomUUID(),
      chatId: dto.chatId,
      messageId: dto.messageId,
      product: {
        id: dto.product.id,
        name: dto.product.name,
        price: dto.product.price,
        currency: dto.product.currency,
        ...(dto.product.imageUrl ? { imageUrl: dto.product.imageUrl } : {}),
      },
      status: 'created',
      createdAt: Date.now(),
    };

    this.orders.push(order);

    try {
      await this.persist();
    } catch (error: unknown) {
      // Si no se pudo guardar, el pedido no existe: se revierte en memoria.
      this.orders = this.orders.filter((o) => o.id !== order.id);
      this.logger.error('No se pudo guardar orders.json', error);
      throw new InternalServerErrorException('No se pudo guardar el pedido');
    }

    return order;
  }

  findOne(id: string): Order {
    const order = this.orders.find((o) => o.id === id);
    if (!order) {
      throw new NotFoundException(`Pedido ${id} no encontrado`);
    }
    return order;
  }

  private async loadOrders(): Promise<Order[]> {
    let raw: string;
    try {
      raw = await readFile(this.filePath, 'utf8');
    } catch (error: unknown) {
      if (isErrnoException(error) && error.code === 'ENOENT') {
        return [];
      }
      throw new Error(
        `No se pudo leer ${this.filePath}: ${errorMessage(error)}`,
      );
    }

    if (raw.trim() === '') {
      return [];
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // No se sobreescribe un archivo corrupto: mejor fallar al arrancar.
      throw new Error(`${this.filePath} no contiene JSON válido`);
    }

    if (!Array.isArray(parsed)) {
      throw new Error(`${this.filePath} debe contener un arreglo de pedidos`);
    }
    return parsed as Order[];
  }

  private persist(): Promise<void> {
    const snapshot = JSON.stringify(this.orders, null, 2) + '\n';
    const next = this.writeQueue.then(() =>
      writeFile(this.filePath, snapshot, 'utf8'),
    );
    // La cola sigue viva aunque esta escritura falle.
    this.writeQueue = next.catch(() => undefined);
    return next;
  }
}
