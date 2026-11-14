import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/main';
import { Order } from '../src/orders/interfaces/order.interface';

const CHAT_ID = 'chat-demo-001';

const validBody = {
  chatId: CHAT_ID,
  messageId: '-Omsg1',
  product: {
    id: 'p-101',
    name: 'Bandeja paisa',
    price: 32000,
    currency: 'COP',
    imageUrl: 'https://ejemplo.com/bandeja.jpg',
  },
};

describe('OrdersController (e2e)', () => {
  let app: INestApplication<App>;
  let dir: string;
  let ordersFile: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'orders-e2e-'));
    ordersFile = join(dir, 'orders.json');
    process.env.ORDERS_FILE = ordersFile;
    process.env.CHAT_ID = CHAT_ID;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  });

  it('POST /orders → 201 y guarda en orders.json', async () => {
    const res = await request(app.getHttpServer())
      .post('/orders')
      .send(validBody)
      .expect(201);

    const order = res.body as Order;
    expect(order).toMatchObject({ ...validBody, status: 'created' });
    expect(typeof order.id).toBe('string');
    expect(typeof order.createdAt).toBe('number');

    const saved = JSON.parse(await readFile(ordersFile, 'utf8')) as Order[];
    expect(saved).toEqual([order]);
  });

  it('GET /orders/:id → 200 con el pedido', async () => {
    const created = await request(app.getHttpServer())
      .post('/orders')
      .send(validBody)
      .expect(201);
    const order = created.body as Order;

    await request(app.getHttpServer())
      .get(`/orders/${order.id}`)
      .expect(200)
      .expect(order);
  });

  it('GET /orders/:id → 404 si no existe', () => {
    return request(app.getHttpServer()).get('/orders/no-existe').expect(404);
  });

  it('POST /orders duplicado (mismo messageId) → 409', async () => {
    await request(app.getHttpServer()).post('/orders').send(validBody).expect(201);
    await request(app.getHttpServer()).post('/orders').send(validBody).expect(409);
  });

  it.each([
    ['falta chatId', { ...validBody, chatId: undefined }],
    ['chatId vacío', { ...validBody, chatId: '' }],
    ['falta messageId', { ...validBody, messageId: undefined }],
    ['falta product', { ...validBody, product: undefined }],
    ['falta product.id', { ...validBody, product: { ...validBody.product, id: undefined } }],
    ['price = 0', { ...validBody, product: { ...validBody.product, price: 0 } }],
    ['price negativo', { ...validBody, product: { ...validBody.product, price: -10 } }],
    ['price como texto', { ...validBody, product: { ...validBody.product, price: '32000' } }],
    ['campo no permitido', { ...validBody, hack: true }],
    ['chatId de otro chat', { ...validBody, chatId: 'otro-chat' }],
  ])('POST /orders con %s → 400', (_caso, body) => {
    return request(app.getHttpServer()).post('/orders').send(body).expect(400);
  });
});
