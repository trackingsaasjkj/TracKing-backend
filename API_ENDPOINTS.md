# TracKing API — Documentación de Endpoints

> Base URL: `http://localhost:3000`
> Autenticación: `Authorization: Bearer <token>` (excepto rutas marcadas como **Público**)
> Formato de respuesta: `{ "success": true, "data": { ... } }`

---

## Índice

- [Auth](#auth)
- [Companies](#companies)
- [Users](#users)
- [Customers](#customers)
- [Mensajeros](#mensajeros)
- [Courier Mobile](#courier-mobile)
- [Services](#services)
- [Evidence](#evidence)
- [Tracking](#tracking)
- [Liquidaciones](#liquidaciones)
- [Reportes](#reportes)
- [BFF Web](#bff-web)
- [Super Admin](#super-admin)
- [Health](#health)
- [Roles y permisos](#roles-y-permisos)
- [Códigos de error](#códigos-de-error)

---

## Auth

Base: `/api/auth`

### POST /api/auth/login
**Público** · Rate limit: 5 req/min

Inicia sesión. Retorna datos del usuario y establece cookies `httpOnly` con `access_token` (15min) y `refresh_token` (7d).

**Body:**
```json
{
  "email": "admin@empresa.com",
  "password": "mi_password"
}
```

**Respuesta 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Juan Pérez",
    "email": "admin@empresa.com",
    "role": "ADMIN",
    "company_id": "uuid-empresa"
  }
}
```

**Errores:** `401` Credenciales inválidas · `429` Demasiados intentos

---

### POST /api/auth/register
**Público**

Registra un nuevo usuario en la empresa indicada.

**Body:**
```json
{
  "name": "Juan Pérez",
  "email": "juan@empresa.com",
  "password": "password123",
  "role": "ADMIN",
  "company_id": "uuid-empresa"
}
```

**Respuesta 201:** Mismo formato que login.

**Errores:** `409` Email ya registrado en esta empresa

---

### POST /api/auth/logout
**Requiere JWT**

Revoca todos los tokens activos del usuario y limpia las cookies.

**Respuesta 200:**
```json
{ "success": true, "data": null }
```

---

### POST /api/auth/refresh
**Público** · Rate limit: 10 req/min

Renueva los tokens usando el `refresh_token` de la cookie. El refresh token es de **un solo uso** (se invalida al usarse).

**Respuesta 200:** Nuevas cookies seteadas, `data: null`

**Errores:** `401` Refresh token inválido o ya utilizado

---

## Companies

Base: `/api/companies`

### POST /api/companies/setup
**Público**

Crea una empresa (tenant) y su usuario ADMIN en una sola transacción atómica. Si cualquier paso falla, nada se guarda.

**Body:**
```json
{
  "company": { "name": "Mi Empresa SAS" },
  "admin": {
    "name": "Juan Pérez",
    "email": "admin@empresa.com",
    "password": "Password123!"
  }
}
```

**Respuesta 201:**
```json
{
  "success": true,
  "data": {
    "company": {
      "id": "uuid",
      "name": "Mi Empresa SAS",
      "status": true,
      "created_at": "2026-01-01T00:00:00.000Z"
    },
    "admin": {
      "id": "uuid",
      "name": "Juan Pérez",
      "email": "admin@empresa.com",
      "role": "ADMIN",
      "company_id": "uuid",
      "created_at": "2026-01-01T00:00:00.000Z"
    }
  }
}
```

**Errores:** `409` Email ya registrado

---

### GET /api/companies
**Requiere JWT**

Lista todas las empresas activas.

**Respuesta 200:** Array de empresas.

---

## Users

Base: `/api/users` · Requiere JWT · Roles: `ADMIN`, `AUX`

### GET /api/users
**Roles:** `ADMIN`, `AUX`

Lista todos los usuarios de la empresa del token.

**Respuesta 200:** Array de usuarios.

---

### GET /api/users/email/:email
**Roles:** `ADMIN`, `AUX`

Busca un usuario por email dentro de la empresa.

**Parámetros:** `email` — dirección de correo

**Errores:** `404` No encontrado

---

### GET /api/users/:uuid
**Roles:** `ADMIN`, `AUX`

Obtiene un usuario por UUID.

**Errores:** `404` No encontrado

---

### POST /api/users
**Roles:** `ADMIN`

Crea un usuario en la empresa del token.

**Body:**
```json
{
  "name": "María López",
  "email": "maria@empresa.com",
  "password": "password123",
  "role": "AUX"
}
```

**Respuesta 201:** Usuario creado.

**Errores:** `409` Email ya registrado

---

### PUT /api/users/:uuid
**Roles:** `ADMIN`

Actualiza datos de un usuario.

**Body:** Campos opcionales: `name`, `email`, `password`, `role`, `status`

---

### DELETE /api/users/:uuid
**Roles:** `ADMIN`

Elimina un usuario de la empresa.

**Respuesta 200:** `{ "success": true, "data": null }`

---

## Customers

Base: `/api/customers` · Requiere JWT · Roles: `ADMIN`, `AUX`

### POST /api/customers
Crea un nuevo cliente en la empresa.

**Body:**
```json
{
  "name": "Pedro Gómez",
  "address": "Calle 10 #20-30, Bogotá",
  "phone": "3001234567",
  "email": "pedro@correo.com"
}
```
`name` y `address` requeridos. `phone` y `email` opcionales.

**Respuesta 201:** Cliente creado.

---

### GET /api/customers
Lista todos los clientes activos de la empresa.

---

### GET /api/customers/:id
Obtiene un cliente por UUID.

**Errores:** `404` No encontrado

---

### PUT /api/customers/:id
Actualiza datos del cliente.

---

### DELETE /api/customers/:id
**Roles:** `ADMIN`

Desactiva el cliente (soft delete). El registro permanece para mantener integridad con servicios históricos.

---

## Mensajeros

Base: `/api/mensajeros` · Requiere JWT

### POST /api/mensajeros
**Roles:** `ADMIN`

Crea un perfil de mensajero asociando un usuario con rol `COURIER`.

**Body:**
```json
{
  "user_id": "uuid-del-usuario",
  "document_id": "1234567890",
  "phone": "3001234567"
}
```

**Respuesta 201:** Perfil de mensajero creado.

**Errores:** `409` El usuario ya tiene perfil de mensajero

---

### GET /api/mensajeros
**Roles:** `ADMIN`, `AUX`

Lista todos los mensajeros de la empresa.

---

### GET /api/mensajeros/activos
**Roles:** `ADMIN`, `AUX`

Lista mensajeros con estado operacional `AVAILABLE`.

---

### GET /api/mensajeros/:id
**Roles:** `ADMIN`, `AUX`

Obtiene un mensajero por UUID.

**Errores:** `404` No encontrado

---

### PUT /api/mensajeros/:id
**Roles:** `ADMIN`

Actualiza datos del mensajero (documento, teléfono).

---

## Courier Mobile

Base: `/api/courier` · Requiere JWT con rol `COURIER`

> API dedicada para la app móvil del mensajero. El `company_id` y `courier_id` se resuelven automáticamente desde el token.

### GET /api/courier/me
Retorna el perfil completo del mensajero autenticado.

---

### POST /api/courier/jornada/start
Inicia la jornada laboral. Transición: `UNAVAILABLE → AVAILABLE`.

**Errores:** `400` Transición inválida desde el estado actual

---

### POST /api/courier/jornada/end
Finaliza la jornada laboral. Transición: `AVAILABLE → UNAVAILABLE`.

> Bloqueado si hay servicios en estado ASSIGNED, ACCEPTED o IN_TRANSIT.

**Errores:** `400` Servicios activos o transición inválida

---

### GET /api/courier/services
Lista los servicios asignados al mensajero autenticado.

---

### POST /api/courier/services/:id/status
Cambia el estado de un servicio.

**Transiciones válidas:**
```
ASSIGNED → ACCEPTED
ACCEPTED → IN_TRANSIT
IN_TRANSIT → DELIVERED  (requiere evidencia previa)
```

**Body:**
```json
{ "status": "ACCEPTED" }
```

**Errores:** `400` Transición inválida o falta evidencia para DELIVERED

---

### POST /api/courier/services/:id/evidence
Sube evidencia fotográfica de entrega. Solo cuando el servicio está en `IN_TRANSIT`.

**Body:**
```json
{ "image_url": "https://storage.ejemplo.com/foto.jpg" }
```

**Errores:** `400` Servicio no está IN_TRANSIT

---

### POST /api/courier/location
Registra la ubicación actual del mensajero. Solo cuando está en estado `IN_SERVICE`.

**Body:**
```json
{
  "latitude": 4.710989,
  "longitude": -74.072092,
  "accuracy": 10.5
}
```

**Errores:** `400` Mensajero no está IN_SERVICE

---

## Services

Base: `/api/services` · Requiere JWT

### POST /api/services
**Roles:** `ADMIN`, `AUX`

Crea un nuevo servicio en estado `PENDING`.

> `total_price` se calcula automáticamente: `delivery_price + product_price`

**Body:**
```json
{
  "customer_id": "uuid-cliente",
  "payment_method": "EFECTIVO",
  "origin_address": "Calle 10 #20-30",
  "origin_contact_phone": "3001234567",
  "destination_address": "Carrera 5 #15-20",
  "destination_contact_number": "3009876543",
  "destination_name": "Pedro Gómez",
  "package_details": "Caja pequeña, frágil",
  "delivery_price": 8000,
  "product_price": 50000,
  "notes_observations": "Llamar antes de llegar"
}
```

**Respuesta 201:** Servicio creado con `status: PENDING`.

**Errores:** `400` Validación de precios o cliente no encontrado

---

### POST /api/services/:id/assign
**Roles:** `ADMIN`, `AUX`

Asigna un mensajero al servicio. Transición: `PENDING → ASSIGNED`.

> El mensajero debe estar en estado `AVAILABLE`.

**Body:**
```json
{ "courier_id": "uuid-mensajero" }
```

**Errores:** `400` Mensajero no disponible o transición inválida

---

### POST /api/services/:id/status
**Roles:** `ADMIN`, `AUX`, `COURIER`

Cambia el estado del servicio.

**Transiciones válidas:**
```
ASSIGNED → ACCEPTED
ACCEPTED → IN_TRANSIT
IN_TRANSIT → DELIVERED  (requiere evidencia previa)
```

**Body:**
```json
{ "status": "ACCEPTED" }
```

**Errores:** `400` Transición inválida o falta evidencia para DELIVERED

---

### POST /api/services/:id/cancel
**Roles:** `ADMIN`, `AUX`

Cancela el servicio. Solo posible en estados: `PENDING`, `ASSIGNED`, `ACCEPTED`.

> Libera automáticamente al mensajero asignado.

**Errores:** `400` No se puede cancelar en el estado actual

---

### GET /api/services
**Roles:** Todos (scoped al tenant del token)

Lista servicios de la empresa. Filtros opcionales por query string.

**Query params:**
| Param | Tipo | Descripción |
|-------|------|-------------|
| `status` | `ServiceStatus` | Filtrar por estado |
| `courier_id` | `string` | Filtrar por mensajero |

---

### GET /api/services/:id
Obtiene un servicio por UUID.

**Errores:** `404` No encontrado

---

### GET /api/services/:id/history
Historial completo de transiciones de estado del servicio.

---

## Evidence

Base: `/api/services/:id/evidence` · Requiere JWT

### POST /api/services/:id/evidence
**Roles:** `ADMIN`, `AUX`, `COURIER`

Sube evidencia de entrega para el servicio. Solo cuando el servicio está en estado `IN_TRANSIT`.

> Re-subir reemplaza la evidencia existente (upsert).

**Body:**
```json
{ "image_url": "https://storage.ejemplo.com/evidencia-123.jpg" }
```

**Respuesta 201:** Evidencia registrada.

**Errores:** `400` Servicio no está IN_TRANSIT · `404` Servicio no encontrado

---

### GET /api/services/:id/evidence
Consulta la evidencia registrada para el servicio.

**Errores:** `404` Sin evidencia registrada o servicio no encontrado

---

## Tracking

Base: `/api/tracking` · Requiere JWT

### POST /api/tracking/location
**Roles:** `COURIER`

El mensajero autenticado registra su ubicación actual.

> Solo permitido cuando el mensajero está en estado `IN_SERVICE`. Frecuencia recomendada: cada 15 segundos.

**Body:**
```json
{
  "latitude": 4.710989,
  "longitude": -74.072092,
  "accuracy": 10.5
}
```

**Respuesta 201:** Ubicación registrada.

**Errores:** `400` Mensajero no está IN_SERVICE · `404` Perfil no encontrado

---

### GET /api/tracking/:courier_id/last
**Roles:** `ADMIN`, `AUX`

Retorna la última ubicación conocida del mensajero.

**Errores:** `404` Sin ubicación registrada

---

### GET /api/tracking/:courier_id/history
**Roles:** `ADMIN`, `AUX`

Historial de ubicaciones del mensajero.

**Query params:**
| Param | Tipo | Descripción |
|-------|------|-------------|
| `from` | `ISO date` | Desde (ej: `2026-01-01T00:00:00Z`) |
| `to` | `ISO date` | Hasta |
| `limit` | `number` | Máximo de registros (default: 100) |

---

### WebSocket — Tracking en tiempo real

**Namespace:** `ws://localhost:3000/tracking`
**Roles:** `ADMIN`, `AUX`

Conexión persistente que recibe la posición de los mensajeros de la empresa en tiempo real. El cliente se une automáticamente al room de su `company_id` al conectarse.

**Autenticación (handshake):**
```js
const socket = io('http://localhost:3000/tracking', {
  auth: { token: 'Bearer eyJ...' }
});
```

**Evento recibido: `location:updated`**
```json
{
  "courier_id": "uuid-mensajero",
  "latitude": 4.710989,
  "longitude": -74.072092,
  "accuracy": 10.5,
  "timestamp": "2026-01-01T12:00:00.000Z"
}
```

> El evento se emite cada vez que un mensajero llama `POST /api/tracking/location`. Frecuencia esperada: ~15 segundos.

---

## Liquidaciones

Base: `/api/liquidations` · Requiere JWT · Roles: `ADMIN`

### POST /api/liquidations/rules
Crea una nueva regla de liquidación. Desactiva automáticamente la regla anterior.

**Body:**
```json
{
  "type": "PERCENTAGE",
  "value": 15
}
```

> `type`: `PERCENTAGE` (porcentaje sobre `delivery_price`) o `FIXED` (monto fijo por servicio)

**Respuesta 201:** Regla creada.

---

### GET /api/liquidations/rules
Lista todas las reglas de liquidación de la empresa.

---

### GET /api/liquidations/rules/active
Retorna la regla activa actual.

---

### POST /api/liquidations/generate/courier
Genera la liquidación de un mensajero por servicios `DELIVERED` en el rango de fechas.

> Requiere regla activa configurada.

**Body:**
```json
{
  "courier_id": "uuid-mensajero",
  "start_date": "2026-01-01",
  "end_date": "2026-01-31"
}
```

**Respuesta 201:** Liquidación generada con `total_earned`.

**Errores:** `400` Sin servicios en el rango, total inválido o sin regla activa · `404` Mensajero no encontrado

---

### POST /api/liquidations/generate/customer
Genera la liquidación de cliente (facturación). Suma `total_price` de servicios `DELIVERED` en el rango.

**Body:**
```json
{
  "start_date": "2026-01-01",
  "end_date": "2026-01-31"
}
```

**Errores:** `400` Sin servicios en el rango o total inválido

---

### GET /api/liquidations
Lista liquidaciones de mensajeros.

**Query params:** `courier_id` (opcional) — filtrar por mensajero

---

### GET /api/liquidations/customer
Lista liquidaciones de clientes (facturación).

---

### GET /api/liquidations/earnings
Resumen de ganancias acumuladas.

**Query params:** `courier_id` (opcional)

---

### GET /api/liquidations/:id
Detalle de una liquidación de mensajero por UUID.

**Errores:** `404` No encontrada

---

## Reportes

Base: `/api/reports` · Requiere JWT

### GET /api/reports/services
**Roles:** `ADMIN`, `AUX`

Reporte operativo de servicios con métricas por estado.

**Query params:**
| Param | Tipo | Descripción |
|-------|------|-------------|
| `from` | `date` | Desde (ej: `2026-01-01`) |
| `to` | `date` | Hasta |
| `courier_id` | `string` | Filtrar por mensajero |

---

### GET /api/reports/financial
**Roles:** `ADMIN`

Reporte financiero del período. `from` y `to` son requeridos.

**Query params:** `from` (requerido), `to` (requerido)

**Errores:** `400` Rango de fechas inválido o faltante

---

### GET /api/reports/couriers
**Roles:** `ADMIN`, `AUX`

Rendimiento agrupado por mensajero.

**Query params:** `from`, `to` (opcionales)

---

## BFF Web

Base: `/api/bff` · Requiere JWT · Roles: `ADMIN`, `AUX`

> Endpoints agregados para el panel web. Cada endpoint consolida múltiples llamadas internas en paralelo y retorna todo lo necesario para una vista en una sola respuesta. Los endpoints originales siguen disponibles sin cambios.

### GET /api/bff/dashboard
**Roles:** `ADMIN`, `AUX`

Datos para el panel principal. Consolida servicios pendientes, mensajeros activos e ingresos del día.

**Respuesta 200:**
```json
{
  "success": true,
  "data": {
    "pending_services": [ /* servicios con status PENDING */ ],
    "active_couriers": [ /* mensajeros con status AVAILABLE */ ],
    "today_financial": { /* reporte financiero del día actual */ }
  }
}
```

---

### GET /api/bff/active-orders
**Roles:** `ADMIN`, `AUX`

Datos para la vista de pedidos activos. Retorna todos los servicios y los mensajeros disponibles para el modal de asignación.

**Respuesta 200:**
```json
{
  "success": true,
  "data": {
    "services": [ /* todos los servicios de la empresa */ ],
    "available_couriers": [ /* mensajeros con status AVAILABLE */ ]
  }
}
```

---

### GET /api/bff/reports
**Roles:** `ADMIN`, `AUX`

Reportes consolidados. `from` y `to` son **obligatorios**.

**Query params:**
| Param | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `from` | `ISO date` | ✅ | Fecha inicio (ej: `2026-01-01`) |
| `to` | `ISO date` | ✅ | Fecha fin (ej: `2026-01-31T23:59:59`) |

**Respuesta 200:**
```json
{
  "success": true,
  "data": {
    "services": { /* reporte operativo de servicios */ },
    "financial": { /* reporte financiero */ }
  }
}
```

**Errores:** `400` `from` o `to` ausentes o `from >= to`

---

### GET /api/bff/settlements
**Roles:** `ADMIN`

Datos para la pantalla de liquidaciones. `courier_id` es opcional.

**Query params:**
| Param | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `courier_id` | `UUID` | ❌ | Filtrar por mensajero |

**Respuesta 200:**
```json
{
  "success": true,
  "data": {
    "couriers": [ /* mensajeros activos */ ],
    "active_rule": { /* regla de liquidación activa o null */ },
    "earnings": {
      "total_settlements": 5,
      "total_services": 87,
      "total_earned": 130500,
      "settlements": [ /* historial de liquidaciones */ ]
    }
  }
}
```

---

## Super Admin

Base: `/super-admin` · Requiere JWT con rol `SUPER_ADMIN` · Rate limit: 30 req/min

> Todos los endpoints de esta sección requieren autenticación con un usuario de rol `SUPER_ADMIN`.

---

### GET /super-admin/health
Verificación de estado del módulo Super Admin.

**Respuesta:** `{ "status": "ok" }`

---

### GET /super-admin/dashboard
Métricas globales del sistema en tiempo real.

**Respuesta 200:**
```json
{
  "success": true,
  "data": {
    "activeTenants": 12,
    "usersByRole": { "SUPER_ADMIN": 1, "ADMIN": 24, "AUX": 18, "COURIER": 87 },
    "servicesByStatus": { "PENDING": 5, "ASSIGNED": 12, "DELIVERED": 340, "CANCELLED": 8 },
    "couriersByStatus": { "AVAILABLE": 23, "UNAVAILABLE": 64, "IN_SERVICE": 12 }
  }
}
```

---

### GET /super-admin/tenants
Lista todos los tenants con paginación.

**Query params:** `page` (default: 1), `limit` (default: 20)

---

### POST /super-admin/tenants
Crea un nuevo tenant.

**Body:**
```json
{ "name": "Nueva Empresa SAS" }
```

**Errores:** `409` Ya existe un tenant con ese nombre

---

### GET /super-admin/tenants/by-volume
Tenants ordenados por volumen de servicios en un período.

**Query params:** `from` (ISO date), `to` (ISO date)

---

### GET /super-admin/tenants/:id
Detalle de un tenant con conteo de usuarios, servicios y mensajeros.

**Errores:** `404` Tenant no encontrado

---

### GET /super-admin/tenants/:id/metrics
Métricas operativas y financieras de un tenant en un período.

**Query params:** `from` (ISO date), `to` (ISO date)

**Respuesta 200:**
```json
{
  "success": true,
  "data": {
    "servicesByStatus": { "PENDING": 2, "ASSIGNED": 5, "DELIVERED": 120, "CANCELLED": 3 },
    "activeCouriers": 8,
    "totalSettled": 1250000
  }
}
```

---

### PATCH /super-admin/tenants/:id/suspend
Suspende un tenant (`status: false`).

---

### PATCH /super-admin/tenants/:id/reactivate
Reactiva un tenant suspendido (`status: true`).

---

### DELETE /super-admin/tenants/:id
Elimina un tenant permanentemente. Registra en audit log.

---

### GET /super-admin/tenants/:id/users
Lista usuarios de un tenant con filtros opcionales.

**Query params:** `page`, `limit`, `role` (`ADMIN`|`AUX`|`COURIER`), `status` (`ACTIVE`|`SUSPENDED`)

---

### PATCH /super-admin/users/:id/suspend
Suspende un usuario (`status: SUSPENDED`).

---

### PATCH /super-admin/users/:id/reactivate
Reactiva un usuario suspendido (`status: ACTIVE`).

---

### PATCH /super-admin/users/:id/role
Cambia el rol de un usuario.

**Body:**
```json
{ "role": "ADMIN" }
```

**Errores:** `422` No se puede asignar `SUPER_ADMIN` a un usuario con tenant

---

### DELETE /super-admin/users/:id
Elimina un usuario permanentemente. Registra en audit log.

---

### GET /super-admin/config
Lista todas las configuraciones globales del sistema.

---

### POST /super-admin/config
Crea una nueva configuración global.

**Body:**
```json
{
  "key": "MAX_SERVICES_PER_COURIER",
  "value": "10",
  "description": "Máximo de servicios simultáneos por mensajero"
}
```

**Errores:** `409` Ya existe una configuración con esa clave

---

### PATCH /super-admin/config/:key
Actualiza el valor de una configuración por su clave.

**Body:**
```json
{ "value": "15" }
```

**Errores:** `404` Configuración no encontrada

---

### GET /super-admin/audit-log
Consulta el registro de auditoría con filtros.

**Query params:**
| Param | Tipo | Descripción |
|-------|------|-------------|
| `super_admin_id` | `string` | Filtrar por admin que realizó la acción |
| `entity_type` | `string` | Tipo de entidad (`Company`, `User`) |
| `action` | `string` | Acción (`DELETE_TENANT`, `DELETE_USER`) |
| `from` | `ISO date` | Desde |
| `to` | `ISO date` | Hasta |
| `page` | `number` | Página (default: 1) |
| `limit` | `number` | Registros por página (default: 20) |

---

## Health

### GET /api/health
**Público**

Verifica el estado del servidor y la conexión a la base de datos.

**Respuesta 200:**
```json
{ "status": "ok", "info": { "database": { "status": "up" } } }
```

---

## Roles y permisos

| Endpoint | SUPER_ADMIN | ADMIN | AUX | COURIER | Público |
|----------|:-----------:|:-----:|:---:|:-------:|:-------:|
| POST /api/auth/login | ✅ | ✅ | ✅ | ✅ | ✅ |
| POST /api/auth/register | ✅ | ✅ | ✅ | ✅ | ✅ |
| POST /api/auth/logout | ✅ | ✅ | ✅ | ✅ | — |
| POST /api/companies/setup | ✅ | ✅ | ✅ | ✅ | ✅ |
| GET /api/users | ✅ | ✅ | ✅ | — | — |
| POST /api/users | ✅ | ✅ | — | — | — |
| DELETE /api/users/:id | ✅ | ✅ | — | — | — |
| POST /api/customers | ✅ | ✅ | ✅ | — | — |
| GET /api/customers | ✅ | ✅ | ✅ | — | — |
| DELETE /api/customers/:id | ✅ | ✅ | — | — | — |
| POST /api/mensajeros | ✅ | ✅ | — | — | — |
| GET /api/mensajeros | ✅ | ✅ | ✅ | — | — |
| GET /api/courier/me | — | — | — | ✅ | — |
| POST /api/courier/jornada/start | — | — | — | ✅ | — |
| POST /api/courier/jornada/end | — | — | — | ✅ | — |
| GET /api/courier/services | — | — | — | ✅ | — |
| POST /api/courier/services/:id/status | — | — | — | ✅ | — |
| POST /api/courier/services/:id/evidence | — | — | — | ✅ | — |
| POST /api/courier/location | — | — | — | ✅ | — |
| POST /api/services | ✅ | ✅ | ✅ | — | — |
| POST /api/services/:id/assign | ✅ | ✅ | ✅ | — | — |
| POST /api/services/:id/status | ✅ | ✅ | ✅ | ✅ | — |
| POST /api/tracking/location | — | — | — | ✅ | — |
| GET /api/tracking/:id/last | ✅ | ✅ | ✅ | — | — |
| GET /api/liquidations/* | ✅ | ✅ | — | — | — |
| GET /api/reports/* | ✅ | ✅ | ✅* | — | — |
| GET /api/bff/dashboard | ✅ | ✅ | ✅ | — | — |
| GET /api/bff/active-orders | ✅ | ✅ | ✅ | — | — |
| GET /api/bff/reports | ✅ | ✅ | ✅ | — | — |
| GET /api/bff/settlements | ✅ | ✅ | — | — | — |
| /super-admin/* | ✅ | — | — | — | — |

> *AUX tiene acceso a reportes de servicios y mensajeros, pero no al reporte financiero.

---

## Códigos de error

| Código | Significado |
|--------|-------------|
| `400` | Bad Request — validación fallida o lógica de negocio |
| `401` | Unauthorized — token ausente, inválido o expirado |
| `403` | Forbidden — rol insuficiente |
| `404` | Not Found — recurso no existe |
| `409` | Conflict — duplicado (email, nombre de tenant, clave de config) |
| `422` | Unprocessable Entity — regla de negocio violada |
| `429` | Too Many Requests — rate limit excedido |
| `500` | Internal Server Error |

**Formato de error:**
```json
{
  "success": false,
  "statusCode": 404,
  "error": "Recurso no encontrado"
}
```

---

*TracKing SaaS © 2026*
