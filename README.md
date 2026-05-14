<div align="center">

# 🚚 TracKing — Backend API

**Plataforma multi-tenant para gestión de servicios de mensajería y logística**

[![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?style=flat-square&logo=nestjs)](https://nestjs.com)
[![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?style=flat-square&logo=prisma)](https://prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql)](https://postgresql.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

</div>

---

## ¿Qué es TracKing?

TracKing es un backend REST API que permite a múltiples empresas (tenants) gestionar de forma independiente sus operaciones de mensajería: creación de servicios, asignación de mensajeros, seguimiento en tiempo real, evidencias de entrega y liquidaciones financieras.

Cada empresa opera en un espacio completamente aislado. Un **Super Admin** centralizado puede supervisar y administrar todos los tenants desde un panel unificado.

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Framework | NestJS 10 (arquitectura DDD) |
| ORM | Prisma 5 |
| Base de datos | PostgreSQL 16 (Supabase) |
| Almacenamiento | Supabase Storage (evidencias fotográficas) |
| Autenticación | JWT — access token 15min + refresh token 7d (single-use rotation) |
| WebSockets | Socket.IO (`@nestjs/websockets`) — tracking y dashboard en tiempo real |
| Notificaciones push | Firebase Admin SDK (FCM) |
| Geocodificación | Mapbox API |
| Cache | Redis (opcional, vía ioredis) |
| IA | OpenAI API (opcional, parsing de servicios) |
| Validación | class-validator + class-transformer |
| Documentación | Swagger UI (`@nestjs/swagger`) con login personalizado |
| Rate limiting | `@nestjs/throttler` (por ruta y rol) |
| Testing | Jest + fast-check (property-based testing) |

---

## Arquitectura

```
src/
├── config/              # Variables de entorno validadas (class-validator)
├── core/
│   ├── constants/       # Enums: Role, Permission
│   ├── controllers/     # Controladores base reutilizables
│   ├── decorators/      # @CurrentUser, @Roles, @Public, @RequirePermissions
│   ├── dto/             # DTOs compartidos
│   ├── errors/          # AppException (HTTP exceptions tipadas)
│   ├── filters/         # Filtros de excepción globales
│   ├── guards/          # JwtAuthGuard, RolesGuard, PermissionsGuard, SuperAdminGuard
│   ├── types/           # Tipos TypeScript globales
│   └── utils/           # response.util (formato estándar { success, data })
├── infrastructure/
│   ├── cache/           # RedisModule + CacheService
│   ├── database/        # PrismaModule + PrismaService
│   └── storage/         # SupabaseStorageService
└── modules/
    ├── auth/            # Login, registro, logout, refresh token
    ├── company/         # Gestión de tenants (empresas) y setup inicial
    ├── users/           # Usuarios por empresa con permisos granulares
    ├── mensajeros/      # Perfiles de mensajeros y jornadas
    ├── servicios/       # Ciclo de vida de servicios de entrega
    ├── customers/       # Clientes con búsqueda y upsert inteligente
    ├── evidencias/      # Evidencias fotográficas de entrega (Supabase Storage)
    ├── tracking/        # Geolocalización en tiempo real (WebSocket)
    ├── liquidaciones/   # Liquidaciones de mensajeros y clientes
    ├── reportes/        # Reportes operativos y financieros ampliados
    ├── notifications/   # Notificaciones push FCM
    ├── planes/          # Planes de suscripción
    ├── suscripciones/   # Gestión de suscripciones por empresa
    ├── search/          # Búsqueda global cross-módulo
    ├── courier-mobile/  # Endpoints optimizados para la app móvil del mensajero
    ├── bff-web/         # Backend for Frontend — endpoints agregados para el panel web
    ├── health/          # Health check
    └── super-admin/     # Panel de control centralizado cross-tenant
```

---

## Roles y permisos

| Rol | Descripción |
|-----|-------------|
| `SUPER_ADMIN` | Acceso total al sistema. Sin tenant asociado. |
| `ADMIN` | Gestión completa dentro de su empresa. |
| `AUX` | Operaciones de consulta y gestión de servicios. |
| `COURIER` | Solo sus propios servicios y ubicación. |

Los permisos son granulares y se asignan por usuario. El guard `PermissionsGuard` evalúa permisos individuales además del rol.

---

## Instalación y configuración

### Prerrequisitos

- Node.js 18+
- PostgreSQL 14+ (o proyecto Supabase)
- npm 9+

### 1. Clonar e instalar

```bash
git clone https://github.com/tu-usuario/tracking-backend.git
cd tracking-backend
npm install
```

### 2. Variables de entorno

```bash
cp .env.example .env
```

Editar `.env`:

```env
# Base de datos (Supabase o PostgreSQL directo)
DATABASE_URL="postgresql://user:password@host:5432/db?sslmode=require"
DIRECT_URL="postgresql://user:password@host:5432/db?sslmode=require"

# JWT
JWT_SECRET="secreto_muy_seguro_min_32_chars"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="refresh_secreto_muy_seguro"
JWT_REFRESH_EXPIRES_IN="7d"

# Supabase Storage (evidencias fotográficas)
SUPABASE_URL="https://tu-proyecto.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJ..."
SUPABASE_STORAGE_BUCKET="evidencias"

# Mapbox (geocodificación de direcciones)
MAPBOX_ACCESS_TOKEN="pk.eyJ1..."
MAPBOX_COUNTRY="co"
MAPBOX_PROXIMITY_LNG="-73.122742"
MAPBOX_PROXIMITY_LAT="7.119349"

# Firebase FCM (notificaciones push — elige una opción)
# Opción A — recomendada para Render (service account en base64)
FIREBASE_SERVICE_ACCOUNT_BASE64="base64_del_json..."
# Opción B — desarrollo local (variables individuales)
FIREBASE_PROJECT_ID="tu-proyecto"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk@tu-proyecto.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# OpenAI (opcional — parsing inteligente de servicios)
OPENAI_API_KEY="sk-..."

# Redis (opcional — cache distribuida)
REDIS_URL=""

# Swagger (acceso protegido)
SWAGGER_ENABLED=true
SWAGGER_USER=admin
SWAGGER_PASSWORD=tu_password_seguro

# App
PORT=3000
NODE_ENV=development
```

### 3. Base de datos

> ⚠️ **Lee esto antes de ejecutar cualquier comando de migración**

| Comando | Cuándo usarlo | Efecto sobre datos |
|---------|--------------|-------------------|
| `prisma migrate dev` | Solo en tu entorno local, DB vacía o nueva | Puede hacer **reset** (borra todos los datos) si detecta inconsistencias |
| `prisma migrate deploy` | DB existente con datos, staging, producción | Solo aplica migraciones pendientes, **nunca borra datos** |

**Primera instalación (DB vacía):**
```bash
npm run prisma:generate
npm run prisma:migrate:dev    # solo para DB local vacía
```

**Actualizar una DB existente con datos:**
```bash
npm run prisma:generate
npm run prisma:migrate        # usa migrate deploy — seguro para datos existentes
```

### 4. Iniciar servidor

```bash
# Desarrollo (watch mode)
npm run start:dev

# Producción
npm run build
npm run start:prod
```

---

## Documentación API

La documentación interactiva está disponible en:

```
http://localhost:3000/api/docs
```

> Protegida con login personalizado. Usa las credenciales configuradas en `SWAGGER_USER` / `SWAGGER_PASSWORD`.

Para autenticarte en los endpoints:
1. Ejecuta `POST /api/companies/setup` para crear empresa y admin inicial
2. Ejecuta `POST /api/auth/login` con email y password
3. Copia el `accessToken` de la respuesta
4. Haz clic en **Authorize** → ingresa `Bearer <token>`

Ver [API_ENDPOINTS.md](API_ENDPOINTS.md) para el listado completo de endpoints por módulo.

---

## Scripts disponibles

```bash
npm run start:dev           # Servidor en modo desarrollo (watch)
npm run start:prod          # Servidor en producción
npm run build               # Compilar TypeScript + generar cliente Prisma
npm run test                # Ejecutar tests (runInBand)
npm run test:run            # Tests sin fallar si no hay ninguno
npm run test:cov            # Tests con cobertura
npm run lint                # Lint + autofix
npm run format              # Prettier
npm run prisma:generate     # Regenerar cliente Prisma
npm run prisma:migrate      # Aplicar migraciones (deploy — seguro para datos)
npm run prisma:migrate:dev  # Crear nueva migración (solo DB local vacía)
npm run prisma:studio       # Abrir Prisma Studio
```

---

## WebSockets

El servidor expone dos namespaces Socket.IO:

| Namespace | Propósito |
|-----------|-----------|
| `/tracking` | Posición GPS en tiempo real de mensajeros |
| `/dashboard` | Actualizaciones de servicios y métricas en vivo |

La autenticación se realiza enviando el `accessToken` en el handshake (query param o auth header), ya que las cookies no se envían en conexiones WebSocket.

---

## Multi-tenancy

- Cada entidad tiene `company_id` que la vincula a un tenant
- El `company_id` se extrae automáticamente del JWT — nunca del body
- Ninguna query cruza datos entre empresas
- El `SUPER_ADMIN` opera sin `company_id` y tiene acceso cross-tenant

---

## Formato de respuesta

Todas las respuestas siguen el mismo contrato:

```json
// Éxito
{ "success": true, "data": { ... } }

// Error
{ "success": false, "statusCode": 404, "error": "Recurso no encontrado" }
```

---

## Seguridad

- Tokens JWT con rotación single-use en refresh
- Rate limiting por ruta (`short: 20/min`, `auth: 10/min`, `super-admin: 30/min`)
- Contraseñas hasheadas con bcrypt (12 rounds)
- Cookies `httpOnly`, `sameSite: strict`, `secure` en producción
- Swagger protegido con sesión de 8 horas
- Validación estricta de DTOs (`whitelist: true`, `forbidNonWhitelisted: true`)
- Variables de entorno validadas al arranque con class-validator

---

## Despliegue (Render)

El proyecto incluye `render.yaml` con la configuración de despliegue. Ver [`.github/agents/render.agent.md`](.github/agents/render.agent.md) para instrucciones detalladas.

---

## Contribuir

Ver [CONTRIBUTING.md](CONTRIBUTING.md) para guías de contribución.

---

<div align="center">
  <sub>TracKing SaaS © 2026 — Construido con NestJS + Prisma + PostgreSQL</sub>
</div>
