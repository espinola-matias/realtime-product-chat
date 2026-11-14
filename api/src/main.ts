import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/** Configuración compartida por el servidor real y las pruebas e2e. */
export function setupApp(app: INestApplication): void {
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  setupApp(app);

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');
  Logger.log(`API escuchando en http://localhost:${port}`, 'Bootstrap');
}

if (require.main === module) {
  bootstrap().catch((error: unknown) => {
    Logger.error(
      error instanceof Error ? error.message : String(error),
      'Bootstrap',
    );
    process.exit(1);
  });
}
