# Mensajería Backend — Documentación

Backend multi-tenant para gestión de servicios de mensajería y logística.
Construido con NestJS, Prisma, PostgreSQL y arquitectura DDD.

## Swagger UI

```
http://localhost:3000/api/docs
```

Para autenticarse en Swagger:
1. Ejecutar `POST /api/auth/login`
2. Copiar el token de la respuesta (también disponible en cookie `access_token`)
3. Clic en **Authorize** → ingresar `Bearer <token>`

## Fases

| Fase | Estado | Documento |
|------|--------|-----------|
| 1 — Autenticación, Multi-Tenant y Usuarios | ✅ Completada | [fase-1-autenticacion.md](./fase-1-autenticacion.md) |
| 2 — Gestión de Servicios | ✅ Completada | [fase-2-servicios.md](./fase-2-servicios.md) |
| 3 — Mensajeros y Operación | ✅ Completada | [fase-3-mensajeros.md](./fase-3-mensajeros.md) |
| 4 — Evidencias | ✅ Completada | [fase-4-evidencias.md](./fase-4-evidencias.md) |
| 5 — Geolocalización | ✅ Completada | [fase-5-geolocalizacion.md](./fase-5-geolocalizacion.md) |
| 6 — Liquidaciones | ✅ Completada | [fase-6-liquidaciones.md](./fase-6-liquidaciones.md) |
| 7 — Reportes | 🔜 Pendiente | [fase-7-reportes.md](./fase-7-reportes.md) |
| 8 — Notificaciones Push (FCM) | ✅ Completada | [fase-notificaciones.md](./fase-notificaciones.md) |
| WebSocket — Tiempo Real | ✅ Documentado | [websocket.md](./websocket.md) |

## Stack

- **Framework:** NestJS 10
- **ORM:** Prisma 5
- **DB:** PostgreSQL (Supabase)
- **Auth:** JWT (access 15m + refresh 7d, single-use rotation)
- **Notificaciones:** Firebase Admin SDK (FCM)
- **Cache:** Redis (opcional, fallback en memoria)
- **Storage:** Supabase Storage
- **Geocoding:** Mapbox
- **Validación:** class-validator + class-transformer
- **Docs:** @nestjs/swagger

## Setup rápido

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET

# 3. Generar cliente Prisma
npm run prisma:generate

# 4a. Primera instalación (DB vacía)
npm run prisma:migrate

# 4b. DB existente con datos — usa deploy, no migrate dev
npx prisma migrate deploy

# 5. Iniciar servidor
npm run start:dev

# 6. Abrir Swagger
open http://localhost:3000/api/docs
```

> ⚠️ `prisma migrate dev` puede borrar todos los datos si la DB ya tiene contenido y detecta inconsistencias. Para DBs con datos usa siempre `prisma migrate deploy`.

## Primer uso

```
1. POST /api/companies/setup  →  crear empresa + admin en una operación
2. POST /api/auth/login       →  { email, password }
3. Usar el token para operar
```

Ver [fase-empresa-setup.md](./fase-empresa-setup.md) para detalle completo.

Todas las respuestas siguen el formato:

```json
{ "success": true, "data": { ... } }
{ "success": false, "error": "mensaje de error" }
```

## Multi-tenancy

- Cada entidad tiene `company_id`
- El `company_id` se extrae del JWT en cada request
- Nunca se acepta `company_id` del body en endpoints protegidos
- Ninguna query cruza datos entre empresas
