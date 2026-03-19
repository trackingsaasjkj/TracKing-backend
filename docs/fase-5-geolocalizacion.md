# FASE 5 — Geolocalización

## Objetivo
Registrar y consultar la ubicación en tiempo real del mensajero durante un servicio activo.

## Entidades involucradas
- `courier_location` (tabla DB)
- `courier`

## Endpoints planificados

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| POST | `/api/tracking/location` | COURIER | Registrar ubicación actual |
| GET | `/api/tracking/:courier_id/last` | ADMIN, AUX | Última ubicación del mensajero |
| GET | `/api/tracking/:courier_id` | ADMIN, AUX | Historial de ubicaciones |

## Reglas de negocio

- Solo se registra ubicación si el mensajero está en estado `IN_SERVICE`
- Frecuencia recomendada: cada 15 segundos desde el cliente
- Cada registro incluye: `latitude`, `longitude`, `accuracy`, `registration_date`
- Todas las queries scoped por `company_id`

## Estructura esperada

```
src/modules/tracking/
├── domain/
│   └── rules/validar-tracking.rule.ts
├── infrastructure/
│   └── location.repository.ts
├── application/
│   ├── dto/register-location.dto.ts
│   └── use-cases/
│       ├── registrar-ubicacion.use-case.ts
│       └── consultar-ubicacion.use-case.ts
├── tracking.controller.ts
└── tracking.module.ts
```

## DTO esperado

```json
POST /api/tracking/location
{
  "latitude": 4.710989,
  "longitude": -74.072092,
  "accuracy": 10.5
}
```

## Notas de implementación

- Para tiempo real considerar WebSocket (`infrastructure/realtime/websocket.gateway.ts`)
- El índice `idx_location_company_courier_date` en DB optimiza consultas de última ubicación
- La consulta de última ubicación usa `ORDER BY registration_date DESC LIMIT 1`
