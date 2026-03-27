# BFF Web — Backend for Frontend

## Objetivo

El módulo `bff-web` expone endpoints agregados orientados a las vistas del panel web (roles `ADMIN` y `AUX`). En lugar de que el frontend haga múltiples llamadas paralelas para construir una pantalla, cada endpoint BFF consolida esas llamadas internamente y retorna todo lo necesario en una sola respuesta.

No es un proxy HTTP — los use-cases del BFF importan directamente los use-cases y repositorios de los módulos existentes, ejecutando las queries en paralelo con `Promise.all`.

---

## Endpoints

Base: `/api/bff` · Requiere JWT · Roles: `ADMIN`, `AUX` (ver detalle por endpoint)

| Método | Ruta | Roles | Reemplaza |
|--------|------|-------|-----------|
| GET | `/api/bff/dashboard` | ADMIN, AUX | 3 llamadas → 1 |
| GET | `/api/bff/active-orders` | ADMIN, AUX | 2 llamadas → 1 |
| GET | `/api/bff/reports` | ADMIN, AUX | 2 llamadas → 1 |
| GET | `/api/bff/settlements` | ADMIN | 3 llamadas → 1 |

---

## GET /api/bff/dashboard

Consolida los datos necesarios para el panel principal.

**Reemplaza:**
- `GET /api/services?status=PENDING`
- `GET /api/mensajeros/activos`
- `GET /api/reports/financial?from=hoy&to=hoy`

**Respuesta 200:**
```json
{
  "success": true,
  "data": {
    "pending_services": [
      {
        "id": "uuid",
        "status": "PENDING",
        "origin_address": "Calle 10 #20-30",
        "destination_address": "Carrera 5 #15-20",
        "total_price": 58000,
        "created_at": "2026-03-27T10:00:00.000Z"
      }
    ],
    "active_couriers": [
      {
        "id": "uuid",
        "status": "AVAILABLE",
        "user": { "name": "Carlos Pérez" }
      }
    ],
    "today_financial": {
      "period": { "from": "2026-03-27", "to": "2026-03-27T23:59:59" },
      "revenue": {
        "total_services": 12,
        "total_price": 696000,
        "total_delivery": 96000,
        "total_product": 600000
      },
      "by_payment_method": [
        { "method": "EFECTIVO", "total": 400000, "count": 7 },
        { "method": "TRANSFERENCIA", "total": 296000, "count": 5 }
      ],
      "settlements": {
        "settled": { "count": 8, "total_earned": 12000 },
        "unsettled": { "count": 4, "total_earned": 0 }
      }
    }
  }
}
```

---

## GET /api/bff/active-orders

Consolida los datos para la vista de pedidos activos, incluyendo los mensajeros disponibles para el modal de asignación.

**Reemplaza:**
- `GET /api/services`
- `GET /api/mensajeros/activos`

**Respuesta 200:**
```json
{
  "success": true,
  "data": {
    "services": [ /* array completo de servicios */ ],
    "available_couriers": [
      {
        "id": "uuid",
        "status": "AVAILABLE",
        "user": { "name": "Carlos Pérez" },
        "document_id": "1234567890",
        "phone": "3001234567"
      }
    ]
  }
}
```

---

## GET /api/bff/reports

Consolida los reportes de servicios y financiero en una sola llamada. `from` y `to` son **obligatorios**.

**Query params:**
| Param | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `from` | `ISO date` | ✅ | Fecha inicio (ej: `2026-01-01`) |
| `to` | `ISO date` | ✅ | Fecha fin (ej: `2026-01-31T23:59:59`) |

**Reemplaza:**
- `GET /api/reports/services?from=&to=`
- `GET /api/reports/financial?from=&to=`

> Nota: el reporte de mensajeros (`/api/reports/couriers`) sigue disponible de forma independiente si se necesita por separado.

**Respuesta 200:**
```json
{
  "success": true,
  "data": {
    "services": {
      "period": { "from": "2026-01-01", "to": "2026-01-31T23:59:59" },
      "by_status": [
        { "status": "DELIVERED", "count": 120 },
        { "status": "CANCELLED", "count": 8 }
      ],
      "by_courier": [
        { "courier_id": "uuid", "courier_name": "Carlos Pérez", "total_services": 45 }
      ],
      "avg_delivery_minutes": 38.5,
      "cancellation": { "rate": 0.06, "total": 8 }
    },
    "financial": {
      "period": { "from": "2026-01-01", "to": "2026-01-31T23:59:59" },
      "revenue": {
        "total_services": 128,
        "total_price": 7424000,
        "total_delivery": 1024000,
        "total_product": 6400000
      },
      "by_payment_method": [
        { "method": "EFECTIVO", "total": 4000000, "count": 70 }
      ],
      "settlements": {
        "settled": { "count": 100, "total_earned": 150000 },
        "unsettled": { "count": 28, "total_earned": 0 }
      }
    }
  }
}
```

**Errores:**
- `400` — `from` o `to` ausentes o `from >= to`

---

## GET /api/bff/settlements

Consolida los datos para la pantalla de liquidaciones. `courier_id` es opcional — sin él retorna datos globales de la empresa.

**Query params:**
| Param | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `courier_id` | `UUID` | ❌ | Filtrar por mensajero específico |

**Reemplaza:**
- `GET /api/mensajeros/activos`
- `GET /api/liquidations/rules/active`
- `GET /api/liquidations/earnings?courier_id=`

**Respuesta 200:**
```json
{
  "success": true,
  "data": {
    "couriers": [
      {
        "id": "uuid",
        "status": "AVAILABLE",
        "user": { "name": "Carlos Pérez" }
      }
    ],
    "active_rule": {
      "id": "uuid",
      "type": "PERCENTAGE",
      "value": 15,
      "active": true,
      "created_at": "2026-01-01T00:00:00.000Z"
    },
    "earnings": {
      "total_settlements": 5,
      "total_services": 87,
      "total_earned": 130500,
      "settlements": [ /* array de liquidaciones */ ]
    }
  }
}
```

---

## Cómo migrar el frontend

### DashboardPage

```typescript
// ANTES — 3 queries separadas
const { data: activeServices } = useQuery({ queryFn: () => servicesService.getAll({ status: 'PENDING' }) })
const { data: activeCouriers } = useQuery({ queryFn: mensajerosService.getActivos })
const { data: financial } = useQuery({ queryFn: () => reportsService.getFinancialReport({ from: today, to: ... }) })

// DESPUÉS — 1 query
const { data } = useQuery({
  queryKey: ['bff', 'dashboard'],
  queryFn: () => api.get('/bff/dashboard'),
})
// data.pending_services, data.active_couriers, data.today_financial
```

### ActiveOrdersPage

```typescript
// ANTES — 2 queries
const { data: services } = useQuery({ queryFn: servicesService.getAll })
const { data: couriers } = useQuery({ queryFn: mensajerosService.getActivos })

// DESPUÉS — 1 query
const { data } = useQuery({
  queryKey: ['bff', 'active-orders'],
  queryFn: () => api.get('/bff/active-orders'),
})
// data.services, data.available_couriers
```

### ReportsPage

```typescript
// ANTES — 3 queries con enabled: !!filters
const { data: servicesReport } = useQuery({ queryFn: () => reportsService.getServicesReport(filters), enabled: !!filters })
const { data: financialReport } = useQuery({ queryFn: () => reportsService.getFinancialReport(filters), enabled: !!filters })
const { data: couriersReport } = useQuery({ queryFn: () => reportsService.getCouriersReport(filters), enabled: !!filters })

// DESPUÉS — 1 query
const { data } = useQuery({
  queryKey: ['bff', 'reports', filters],
  queryFn: () => api.get('/bff/reports', { params: filters }),
  enabled: !!filters,
})
// data.services, data.financial
// couriersReport sigue siendo una llamada independiente si se necesita
```

### SettlementsPage

```typescript
// ANTES — 4 queries
const { data: couriers } = useQuery({ queryFn: mensajerosService.getActivos })
const { data: activeRule } = useQuery({ queryFn: liquidationsService.getActiveRule })
const { data: liquidations } = useQuery({ queryFn: () => liquidationsService.getAll(courierId) })
const { data: earnings } = useQuery({ queryFn: () => liquidationsService.getEarnings(courierId) })

// DESPUÉS — 1 query
const { data } = useQuery({
  queryKey: ['bff', 'settlements', courierId],
  queryFn: () => api.get('/bff/settlements', { params: courierId ? { courier_id: courierId } : {} }),
})
// data.couriers, data.active_rule, data.earnings (incluye settlements dentro)
```

---

## Estructura del módulo

```
src/modules/bff-web/
├── application/
│   ├── dto/
│   │   └── bff-query.dto.ts          # BffReportsQueryDto, BffSettlementsQueryDto
│   └── use-cases/
│       ├── bff-dashboard.use-case.ts
│       ├── bff-active-orders.use-case.ts
│       ├── bff-reports.use-case.ts
│       └── bff-settlements.use-case.ts
├── bff-web.controller.ts
└── bff-web.module.ts
```

## Módulos que exportan dependencias para el BFF

| Módulo | Exports agregados |
|--------|------------------|
| `ServiciosModule` | `ConsultarServiciosUseCase` |
| `MensajerosModule` | `ConsultarMensajerosUseCase` (ya existía) |
| `ReportesModule` | `ReporteServiciosUseCase`, `ReporteFinancieroUseCase` |
| `LiquidacionesModule` | `ConsultarLiquidacionesUseCase`, `GestionarReglasUseCase` |

## Reglas de negocio

- El `company_id` siempre se extrae del JWT, nunca de query params
- Las queries internas se ejecutan en paralelo con `Promise.all`
- Los endpoints BFF no tienen lógica propia — orquestan use-cases existentes
- El módulo no tiene repositorio propio ni accede a Prisma directamente
- Los endpoints originales siguen disponibles sin cambios
