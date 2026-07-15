import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  const port = Number.parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port, '127.0.0.1');
  (process as NodeJS.Process & { parentPort?: { postMessage(message: unknown): void } }).parentPort?.postMessage({ type: 'ready', role: 'api' });
}

void bootstrap();
