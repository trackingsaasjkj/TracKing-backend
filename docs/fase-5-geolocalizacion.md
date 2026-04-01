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

## WebSocket — Tiempo real

El módulo incluye un Gateway de Socket.IO que emite la posición del mensajero en tiempo real a los clientes ADMIN/AUX conectados.

### Namespace y evento

- Namespace: `/tracking`
- Evento emitido: `location:updated`

### Flujo

1. El mensajero llama `POST /api/tracking/location` (HTTP, cada ~15s)
2. El backend guarda en DB y emite `location:updated` al room de la empresa
3. El frontend web recibe el evento y actualiza el marker en el mapa

### Payload del evento

```json
{
  "courier_id": "uuid",
  "latitude": 4.710989,
  "longitude": -74.072092,
  "accuracy": 10.5,
  "timestamp": "2026-01-01T12:00:00.000Z"
}
```

### Autenticación del socket

El cliente debe enviar el JWT en el handshake:

```js
const socket = io('http://localhost:3000/tracking', {
  auth: { token: 'Bearer eyJ...' }
});
```

Solo roles `ADMIN` y `AUX` pueden conectarse. El cliente se une automáticamente al room de su `company_id`.

## Estructura implementada

```
src/modules/tracking/
├── domain/
│   └── rules/validar-tracking.rule.ts
├── infrastructure/
│   └── location.repository.ts
├── application/
│   ├── dto/register-location.dto.ts
│   └── use-cases/
│       ├── registrar-ubicacion.use-case.ts   ← emite evento WS
│       └── consultar-ubicacion.use-case.ts
├── tracking.controller.ts
├── tracking.gateway.ts                        ← Gateway Socket.IO
└── tracking.module.ts
```

## Notas de implementación

- El índice `idx_location_company_courier_date` en DB optimiza consultas de última ubicación
- La consulta de última ubicación usa `ORDER BY registration_date DESC LIMIT 1`
- El Gateway valida el JWT en `handleConnection` y desconecta clientes no autorizados
- Los rooms están scoped por `company_id` — un admin solo recibe ubicaciones de su empresa
