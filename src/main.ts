import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ── Swagger ────────────────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('Mensajería API')
    .setDescription(
      'Backend multi-tenant para gestión de servicios de mensajería y logística.\n\n' +
      '**Autenticación:** Usa `POST /api/auth/login` para obtener el token, ' +
      'luego haz clic en **Authorize** e ingresa `Bearer <token>`.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'access-token',
    )
    .addCookieAuth('access_token')
    .addTag('Auth', 'Autenticación y gestión de sesión')
    .addTag('Companies', 'Gestión de empresas (tenants)')
    .addTag('Users', 'Gestión de usuarios por empresa')
    .addTag('Mensajeros', 'Gestión de mensajeros y jornadas')
    .addTag('Services', 'Ciclo de vida de servicios de entrega')
    .addTag('Evidence', 'Evidencias de entrega')
    .addTag('Tracking', 'Geolocalización de mensajeros en tiempo real')
    .addTag('Liquidaciones', 'Liquidaciones de mensajeros y facturación de clientes')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });
  // ──────────────────────────────────────────────────────────────

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📚 Swagger docs at http://localhost:${port}/api/docs`);
}

bootstrap();
