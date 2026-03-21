import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { logger: ['log', 'warn', 'error', 'debug'] });

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ── Swagger Auth / Visibility ──────────────────────────────────
  const swaggerEnabled = process.env.SWAGGER_ENABLED;
  const swaggerUser = process.env.SWAGGER_USER;
  const swaggerPassword = process.env.SWAGGER_PASSWORD;

  if (swaggerEnabled === 'false') {
    app.use('/api/docs', (req: any, res: any) => {
      res.status(404).send('Not Found');
    });
  } else {
    app.use('/api/docs', (req: any, res: any, next: any) => {
      const authHeader: string | undefined = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Basic ')) {
        const base64 = authHeader.slice('Basic '.length);
        const decoded = Buffer.from(base64, 'base64').toString('utf-8');
        const [user, ...rest] = decoded.split(':');
        const password = rest.join(':');
        if (user === swaggerUser && password === swaggerPassword) {
          return next();
        }
      }
      res.set('WWW-Authenticate', 'Basic realm="Swagger"');
      res.status(401).send('Unauthorized');
    });

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
      .addTag('Super Admin', 'Control centralizado del sistema')
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
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`Server running on port ${port}`);
  logger.log(`Swagger docs at http://localhost:${port}/api/docs`);
}

bootstrap();
