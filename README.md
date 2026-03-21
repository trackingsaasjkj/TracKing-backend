# TracKing Backend

Backend multi-tenant para gestión de servicios de mensajería y logística, construido con NestJS, Prisma y PostgreSQL.

## Requisitos

- Node.js >= 20
- PostgreSQL >= 14
- npm >= 10

## Variables de entorno

Copia `.env.example` a `.env` y completa los valores:

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
DIRECT_URL=postgresql://user:password@host:5432/dbname
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-refresh-secret
JWT_REFRESH_EXPIRES_IN=7d
NODE_ENV=production
PORT=3000
```

## Instalación local

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run start:dev
```

## Scripts disponibles

| Script | Descripción |
|---|---|
| `npm run start:dev` | Servidor en modo desarrollo con hot-reload |
| `npm run build` | Compilar para producción |
| `npm run start:prod` | Iniciar build de producción |
| `npm run lint` | Ejecutar ESLint con auto-fix |
| `npm run format` | Formatear con Prettier |
| `npm run test` | Ejecutar tests |
| `npm run test:cov` | Tests con reporte de cobertura |
| `npm run prisma:generate` | Generar cliente Prisma |
| `npm run prisma:migrate` | Ejecutar migraciones |

## Documentación API

Con el servidor corriendo, accede a Swagger en: `http://localhost:3000/api/docs`

## Healthcheck

`GET /api/health` — verifica el estado del servidor y la conexión a base de datos.

## Deployment con Docker

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run prisma:generate
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["node", "dist/main"]
```

```bash
docker build -t tracking-backend .
docker run -p 3000:3000 --env-file .env tracking-backend
```

## Arquitectura

El proyecto sigue Clean Architecture con separación en capas:

- `domain/` — reglas de negocio y validaciones puras
- `application/use-cases/` — orquestación de casos de uso
- `infrastructure/` — repositorios Prisma, estrategias JWT
- `core/` — guards, decoradores, tipos y utilidades compartidas

## Multi-tenancy

Cada recurso está aislado por `company_id`. Todos los repositorios filtran por `company_id` para garantizar aislamiento entre tenants.

## Seguridad

- JWT con access token (15m) + refresh token rotativo (7d)
- Cookies `httpOnly`, `secure` en producción, `SameSite=strict`
- Rate limiting: 5 intentos de login por minuto por IP
- Lockout automático tras 5 intentos fallidos
- Guards globales: `JwtAuthGuard`, `ThrottlerGuard`
