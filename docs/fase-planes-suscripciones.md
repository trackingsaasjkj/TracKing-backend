# Módulos: Planes y Suscripciones

## Objetivo

Implementar un sistema de monetización SaaS donde el **Super Admin** define planes de servicio y las **empresas (tenants)** se suscriben a uno de ellos. El plan activo de una empresa determina sus límites operativos (mensajeros, servicios, usuarios).

---

## Arquitectura

```
src/modules/planes/
├── application/
│   ├── dto/
│   │   ├── create-plan.dto.ts
│   │   └── update-plan.dto.ts
│   └── use-cases/
│       └── planes.use-cases.ts
├── infrastructure/
│   └── planes.repository.ts
├── planes.controller.ts
└── planes.module.ts

src/modules/suscripciones/
├── application/
│   ├── dto/
│   │   └── create-suscripcion.dto.ts
│   └── use-cases/
│       └── suscripciones.use-cases.ts
├── infrastructure/
│   └── suscripciones.repository.ts
├── suscripciones.controller.ts
└── suscripciones.module.ts
```

---

## Módulo Planes

### Descripción

Los planes son entidades **globales** (sin `company_id`) gestionadas exclusivamente por el `SUPER_ADMIN`. Definen los límites y el precio de cada nivel de servicio.

### Modelo de datos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Identificador único |
| `name` | String | Nombre del plan (ej. "Básico", "Pro", "Enterprise") |
| `description` | String? | Descripción opcional |
| `max_couriers` | Int | Máximo de mensajeros activos permitidos |
| `max_services_per_month` | Int | Máximo de servicios por mes (0 = ilimitado) |
| `max_users` | Int | Máximo de usuarios en la empresa |
| `price` | Decimal | Precio mensual del plan |
| `active` | Boolean | Si el plan está disponible para nuevas suscripciones |
| `created_at` | DateTime | Fecha de creación |

### Endpoints

Base: `/super-admin/plans` · Requiere JWT con rol `SUPER_ADMIN`

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/super-admin/plans` | Listar todos los planes |
| GET | `/super-admin/plans/:id` | Obtener plan por ID |
| POST | `/super-admin/plans` | Crear nuevo plan |
| PUT | `/super-admin/plans/:id` | Actualizar plan |
| PATCH | `/super-admin/plans/:id/deactivate` | Desactivar plan |

#### Crear plan

```
POST /super-admin/plans
Authorization: Bearer <super-admin-token>

{
  "name": "Pro",
  "description": "Plan para empresas medianas",
  "max_couriers": 20,
  "max_services_per_month": 500,
  "max_users": 10,
  "price": 150000
}
```

**Respuesta 201:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Pro",
    "description": "Plan para empresas medianas",
    "max_couriers": 20,
    "max_services_per_month": 500,
    "max_users": 10,
    "price": "150000.00",
    "active": true,
    "created_at": "2026-01-01T00:00:00.000Z"
  }
}
```

### Reglas de negocio

- Solo `SUPER_ADMIN` puede crear, editar o desactivar planes
- No se puede eliminar un plan con suscripciones activas
- Desactivar un plan no afecta las suscripciones existentes
- `max_services_per_month = 0` significa ilimitado
- El nombre del plan debe ser único

---

## Módulo Suscripciones

### Descripción

Una suscripción vincula una **empresa** con un **plan**. Cada empresa tiene como máximo una suscripción activa en un momento dado. El `SUPER_ADMIN` gestiona las suscripciones; los `ADMIN` de empresa solo pueden consultarla.

### Modelo de datos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Identificador único |
| `company_id` | UUID | Empresa suscrita |
| `plan_id` | UUID | Plan contratado |
| `status` | Enum | `ACTIVE`, `CANCELLED`, `EXPIRED` |
| `start_date` | Date | Fecha de inicio |
| `end_date` | Date? | Fecha de vencimiento (null = indefinida) |
| `created_at` | DateTime | Fecha de creación |

### Estados de suscripción

```
ACTIVE ──→ CANCELLED
ACTIVE ──→ EXPIRED   (automático al llegar end_date)
```

### Endpoints

#### Super Admin

Base: `/super-admin/subscriptions` · Requiere JWT con rol `SUPER_ADMIN`

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/super-admin/subscriptions` | Listar todas las suscripciones |
| GET | `/super-admin/subscriptions/:id` | Obtener suscripción por ID |
| POST | `/super-admin/subscriptions` | Crear suscripción para una empresa |
| PATCH | `/super-admin/subscriptions/:id/cancel` | Cancelar suscripción |

#### Admin de empresa

Base: `/api/my-subscription` · Requiere JWT con rol `ADMIN`

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/my-subscription` | Consultar suscripción activa de mi empresa |

#### Crear suscripción (Super Admin)

```
POST /super-admin/subscriptions
Authorization: Bearer <super-admin-token>

{
  "company_id": "uuid-empresa",
  "plan_id": "uuid-plan",
  "start_date": "2026-01-01",
  "end_date": "2026-12-31"
}
```

**Respuesta 201:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "company_id": "uuid-empresa",
    "plan_id": "uuid-plan",
    "status": "ACTIVE",
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "created_at": "2026-01-01T00:00:00.000Z",
    "plan": {
      "name": "Pro",
      "max_couriers": 20,
      "max_services_per_month": 500,
      "max_users": 10,
      "price": "150000.00"
    }
  }
}
```

### Reglas de negocio

- Una empresa solo puede tener **una suscripción ACTIVE** a la vez
- Al crear una nueva suscripción para una empresa que ya tiene una activa, la anterior se cancela automáticamente y queda la nueva
- `end_date` es opcional en el request — si no se provee, se calcula automáticamente como `start_date + 1 mes`
- `end_date` debe ser posterior a `start_date`
- Solo `SUPER_ADMIN` puede crear o cancelar suscripciones
- `ADMIN` de empresa puede consultar su propia suscripción activa en `/api/my-subscription`
- El plan asociado se incluye en la respuesta (join)

---

## Schema Prisma (nuevos modelos)

```prisma
model Plan {
  id                      String   @id @default(uuid())
  name                    String   @unique @db.VarChar(100)
  description             String?
  max_couriers            Int
  max_services_per_month  Int      @default(0)
  max_users               Int
  price                   Decimal  @db.Decimal(12, 2)
  active                  Boolean  @default(true)
  created_at              DateTime @default(now())

  subscriptions Subscription[]

  @@map("plan")
}

model Subscription {
  id         String             @id @default(uuid())
  company_id String
  plan_id    String
  status     SubscriptionStatus @default(ACTIVE)
  start_date DateTime           @db.Date
  end_date   DateTime?          @db.Date   // default: start_date + 1 mes
  created_at DateTime           @default(now())

  company Company @relation(fields: [company_id], references: [id], onDelete: Cascade)
  plan    Plan    @relation(fields: [plan_id], references: [id])

  @@index([company_id, status])
  @@map("subscription")
}

enum SubscriptionStatus {
  ACTIVE
  CANCELLED
  EXPIRED
}
```

---

## Relación con módulos existentes

- `Company` → tendrá relación `subscriptions Subscription[]`
- `SuperAdminModule` → los endpoints de planes y suscripciones se agregan bajo `/super-admin`
- `PlanesModule` y `SuscripcionesModule` se registran en `AppModule`

---

## Roles y permisos

| Endpoint | SUPER_ADMIN | ADMIN | AUX | COURIER |
|----------|:-----------:|:-----:|:---:|:-------:|
| GET /super-admin/plans | ✅ | — | — | — |
| POST /super-admin/plans | ✅ | — | — | — |
| PUT /super-admin/plans/:id | ✅ | — | — | — |
| PATCH /super-admin/plans/:id/deactivate | ✅ | — | — | — |
| GET /super-admin/subscriptions | ✅ | — | — | — |
| POST /super-admin/subscriptions | ✅ | — | — | — |
| PATCH /super-admin/subscriptions/:id/cancel | ✅ | — | — | — |
| GET /api/my-subscription | — | ✅ | — | — |

---

## Flujo de uso

```
1. SUPER_ADMIN crea planes disponibles
   POST /super-admin/plans

2. SUPER_ADMIN suscribe una empresa a un plan
   POST /super-admin/subscriptions  (end_date default: start_date + 1 mes)

3. ADMIN consulta su suscripción activa
   GET /api/my-subscription

4. SUPER_ADMIN cambia el plan de una empresa
   POST /super-admin/subscriptions  (cancela la anterior, activa la nueva)

5. SUPER_ADMIN cancela manualmente una suscripción
   PATCH /super-admin/subscriptions/:id/cancel
```

---

## Archivos a crear

| Archivo | Descripción |
|---------|-------------|
| `src/modules/planes/application/dto/create-plan.dto.ts` | DTO creación de plan |
| `src/modules/planes/application/dto/update-plan.dto.ts` | DTO actualización de plan |
| `src/modules/planes/application/use-cases/planes.use-cases.ts` | Lógica de negocio |
| `src/modules/planes/infrastructure/planes.repository.ts` | Acceso a datos |
| `src/modules/planes/planes.controller.ts` | Controlador HTTP |
| `src/modules/planes/planes.module.ts` | Módulo NestJS |
| `src/modules/suscripciones/application/dto/create-suscripcion.dto.ts` | DTO creación |
| `src/modules/suscripciones/application/use-cases/suscripciones.use-cases.ts` | Lógica de negocio |
| `src/modules/suscripciones/infrastructure/suscripciones.repository.ts` | Acceso a datos |
| `src/modules/suscripciones/suscripciones.controller.ts` | Controlador HTTP |
| `src/modules/suscripciones/suscripciones.module.ts` | Módulo NestJS |
| `prisma/schema.prisma` | Agregar modelos Plan, Subscription, enum SubscriptionStatus |
