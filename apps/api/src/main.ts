import 'dotenv/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { CorsIoAdapter } from './realtime/cors-io.adapter';

function assertSecrets() {
  const isProd = process.env.NODE_ENV === 'production';
  for (const key of ['DATABASE_URL', 'JWT_SECRET']) {
    if (!process.env[key]) throw new Error(`${key} is not set. Copy .env.example to .env and fill it in.`);
  }
  if (isProd && (process.env.JWT_SECRET ?? '').length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production.');
  }
  if (isProd && /change-me/i.test(`${process.env.JWT_SECRET}${process.env.QR_SECRET ?? ''}`)) {
    throw new Error('Replace the placeholder JWT_SECRET / QR_SECRET before running in production.');
  }
}

async function bootstrap() {
  assertSecrets();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const origins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);

  // Behind Render/Railway there is one proxy hop; this makes rate limiting use the real client IP.
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableCors({ origin: origins, credentials: true });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useWebSocketAdapter(new CorsIoAdapter(app, origins));
  app.enableShutdownHooks();

  const uploadDir = (await import('node:path')).resolve(process.env.UPLOAD_DIR ?? './uploads');
  app.useStaticAssets(uploadDir, { prefix: '/uploads', index: false, maxAge: '7d' });

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  new Logger('Foyer').log(`API ready on port ${port} (CORS: ${origins.join(', ')})`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
