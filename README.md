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
| Base de datos | PostgreSQL 16 |
| Autenticación | JWT — access token 15min + refresh token 7d (single-use rotation) |
| Validación | class-validator + class-transformer |
| Documentación | Swagger UI (`@nestjs/swagger`) con login personalizado |
| Rate limiting | `@nestjs/throttler` (por ruta y rol) |
| Testing | Jest + fast-check (property-based testing) |

---

## Arquitectura

```
src/
├── config/              # Variables de entorno validadas
├── core/
│   ├── constants/       # Enums: Role, Permission
│   ├── decorators/      # @CurrentUser, @Roles, @Public, @RequirePermissions
│   ├── guards/          # JwtAuthGuard, RolesGuard, PermissionsGuard, SuperAdminGuard
│   ├── errors/          # AppException (HTTP exceptions tipadas)
│   └── utils/           # response.util (formato estándar { success, data })
├── infrastructure/
│   └── database/        # PrismaModule + PrismaService
└── modules/
    ├── auth/            # Login, registro, logout, refresh token
    ├── company/         # Gestión de tenants (empresas)
    ├── users/           # Usuarios por empresa
    ├── mensajeros/      # Perfiles de mensajeros y jornadas
    ├── servicios/       # Ciclo de vida de servicios de entrega
    ├── evidencias/      # Evidencias fotográficas de entrega
    ├── tracking/        # Geolocalización en tiempo real
    ├── liquidaciones/   # Liquidaciones de mensajeros y clientes
    ├── reportes/        # Reportes operativos y financieros
    ├── bff-web/         # Backend for Frontend — endpoints agregados para el panel web
    ├── health/          # Health check
    └── super-admin/     # Panel de control centralizado
```

---

## Roles y permisos

| Rol | Descripción |
|-----|-------------|
| `SUPER_ADMIN` | Acceso total al sistema. Sin tenant asociado. |
| `ADMIN` | Gestión completa dentro de su empresa. |
| `AUX` | Operaciones de consulta y gestión de servicios. |
| `COURIER` | Solo sus propios servicios y ubicación. |

---

## Instalación y configuración

### Prerrequisitos

- Node.js 18+
- PostgreSQL 14+
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
# Base de datos
DATABASE_URL="postgresql://user:password@localhost:5432/tracking_db"
DIRECT_URL="postgresql://user:password@localhost:5432/tracking_db"

# JWT
JWT_SECRET="tu_secreto_muy_seguro"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="tu_refresh_secreto_muy_seguro"
JWT_REFRESH_EXPIRES_IN="7d"

# Swagger (acceso protegido)
SWAGGER_ENABLED=true
SWAGGER_USER=admin
SWAGGER_PASSWORD=tu_password_seguro
```

### 3. Base de datos

> ⚠️ **Importante — lee esto antes de ejecutar cualquier comando de migración**

Prisma tiene dos comandos de migración con comportamientos muy distintos:

| Comando | Cuándo usarlo | Efecto sobre datos |
|---------|--------------|-------------------|
| `prisma migrate dev` | Solo en tu entorno local, DB vacía o nueva | Puede hacer **reset** (borra todos los datos) si detecta inconsistencias |
| `prisma migrate deploy` | DB existente con datos, staging, producción | Solo aplica migraciones pendientes, **nunca borra datos** |

**Primera instalación (DB vacía):**
```bash
npm run prisma:generate
npm run prisma:migrate:dev    # solo para DB local vacía
```

**Actualizar una DB existente con datos (staging / compartida):**
```bash
npm run prisma:generate
npm run prisma:migrate        # usa migrate deploy — seguro para datos existentes
```

> `npm run prisma:migrate` usa `migrate deploy` por defecto — es el comando seguro.
> `npm run prisma:migrate:dev` es solo para desarrollo local con DB propia.

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
1. Ejecuta `POST /api/companies/setup` para crear empresa y admin
2. Ejecuta `POST /api/auth/login` con email y password
3. Copia el token de la respuesta
4. Haz clic en **Authorize** → ingresa `Bearer <token>`

---

## Scripts disponibles

```bash
npm run start:dev        # Servidor en modo desarrollo (watch)
npm run start:prod       # Servidor en producción
npm run build            # Compilar TypeScript
npm run test             # Ejecutar tests
npm run test:cov         # Tests con cobertura
npm run lint             # Lint + autofix
npm run format           # Prettier
npm run prisma:generate  # Regenerar cliente Prisma
npm run prisma:migrate   # Aplicar migraciones (deploy — seguro para datos)
npm run prisma:migrate:dev  # Crear nueva migración (solo DB local vacía)
npm run prisma:studio    # Abrir Prisma Studio
```

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

---

## Contribuir

Ver [CONTRIBUTING.md](CONTRIBUTING.md) para guías de contribución.

---

<div align="center">
  <sub>TracKing SaaS © 2026 — Construido con NestJS + Prisma + PostgreSQL</sub>
</div>
