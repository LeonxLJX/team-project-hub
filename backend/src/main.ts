import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // ── Global validation pipe ──────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ── Global exception filter ─────────────────────────────
  app.useGlobalFilters(new HttpExceptionFilter());

  // ── Response transform interceptor ──────────────────────
  app.useGlobalInterceptors(new TransformInterceptor());

  // ── CORS ────────────────────────────────────────────────
  app.enableCors({
    origin: configService.get<string>('FRONTEND_URL', 'http://localhost:3000'),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // ── Socket.IO adapter ───────────────────────────────────
  app.useWebSocketAdapter(new IoAdapter(app));

  // ── Global prefix ───────────────────────────────────────
  app.setGlobalPrefix('api');

  const port = configService.get<number>('PORT', 4000);
  await app.listen(port);
  logger.log(`🚀 Team Project Hub API running on http://localhost:${port}`);
}
bootstrap();
