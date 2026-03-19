# FASE 7 — Reportes

## Objetivo
Generar métricas operativas y financieras para toma de decisiones.

## Endpoints planificados

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/api/reports/services` | ADMIN, AUX | Reporte operativo de servicios |
| GET | `/api/reports/financial` | ADMIN | Reporte financiero por período |
| GET | `/api/reports/couriers` | ADMIN, AUX | Rendimiento por mensajero |

## Métricas operativas (`/reports/services`)

- Total de servicios por estado
- Servicios creados por período (día/semana/mes)
- Tiempo promedio de entrega (ASSIGNED → DELIVERED)
- Tasa de cancelación
- Servicios por mensajero

## Métricas financieras (`/reports/financial`)

- Ingresos totales (`total_price`) por período
- Ingresos por método de pago
- Comparativa período actual vs anterior
- Total liquidado vs pendiente de liquidar

## Parámetros de filtro esperados

```
GET /api/reports/services?from=2025-01-01&to=2025-01-31&courier_id=uuid
GET /api/reports/financial?from=2025-01-01&to=2025-01-31
```

## Estructura esperada

```
src/modules/reportes/
├── infrastructure/
│   └── reportes.repository.ts    # Queries agregadas con Prisma
├── application/
│   └── use-cases/
│       ├── reporte-servicios.use-case.ts
│       └── reporte-financiero.use-case.ts
├── reportes.controller.ts
└── reportes.module.ts
```

## Reglas de negocio

- Filtrado por `company_id` obligatorio (multi-tenant)
- Rango de fechas requerido para reportes financieros
- Queries optimizadas con índices existentes en DB:
  - `idx_service_company_status`
  - `idx_service_company_courier`
  - `idx_settlement_courier_company`

## Notas de implementación

- Usar `groupBy` de Prisma para agregaciones
- Para reportes pesados considerar caché (`infrastructure/cache/`)
- Exportación a CSV/PDF es una extensión futura
