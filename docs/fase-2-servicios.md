# FASE 2 — Gestión de Servicios (Core)

## Objetivo
Implementar el ciclo de vida completo de un servicio de mensajería con máquina de estados validada.

## Arquitectura

```
src/modules/servicios/
├── domain/
│   ├── state-machine/servicio.machine.ts
│   └── rules/
│       ├── validar-transicion.rule.ts
│       ├── validar-asignacion.rule.ts
│       ├── validar-entrega.rule.ts
│       └── validar-precio.rule.ts
├── infrastructure/repositories/
│   ├── servicio.repository.ts
│   ├── courier.repository.ts
│   ├── historial.repository.ts
│   └── evidence.repository.ts
├── application/
│   ├── dto/
│   │   ├── crear-servicio.dto.ts
│   │   ├── asignar-servicio.dto.ts
│   │   └── cambiar-estado.dto.ts
│   └── use-cases/
│       ├── crear-servicio.use-case.ts
│       ├── asignar-servicio.use-case.ts
│       ├── cambiar-estado.use-case.ts
│       ├── cancelar-servicio.use-case.ts
│       └── consultar-servicios.use-case.ts
├── servicios.controller.ts
└── servicios.module.ts
```

## Endpoints

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| POST | `/api/services` | ADMIN, AUX | Crear servicio |
| POST | `/api/services/:id/assign` | ADMIN, AUX | Asignar mensajero |
| POST | `/api/services/:id/status` | ADMIN, AUX, COURIER | Cambiar estado |
| POST | `/api/services/:id/cancel` | ADMIN, AUX | Cancelar servicio |
| GET | `/api/services` | Todos | Listar (filtros: status, courier_id) |
| GET | `/api/services/:id` | Todos | Obtener por ID |
| GET | `/api/services/:id/history` | Todos | Historial de estados |

## Máquina de estados

```
PENDING ──→ ASSIGNED ──→ ACCEPTED ──→ IN_TRANSIT ──→ DELIVERED
   │             │            │
   └─────────────┴────────────┴──→ CANCELLED
```

| Desde | Hacia | Condición |
|-------|-------|-----------|
| PENDING | ASSIGNED | Mensajero AVAILABLE |
| PENDING | CANCELLED | Libre |
| ASSIGNED | ACCEPTED | — |
| ASSIGNED | CANCELLED | Libera mensajero |
| ACCEPTED | IN_TRANSIT | — |
| ACCEPTED | CANCELLED | Libera mensajero |
| IN_TRANSIT | DELIVERED | Requiere evidencia previa |

## Reglas de negocio

- `total_price` = `delivery_price` + `product_price` (validado en creación)
- Historial registrado en **cada** cambio de estado
- Al asignar: mensajero pasa a `IN_SERVICE`
- Al entregar o cancelar: mensajero vuelve a `AVAILABLE`
- Solo 1 mensajero por servicio
- Todas las queries scoped por `company_id`

## Flujo de prueba (Swagger)

```
1. POST /api/services → crear servicio (guardar id)
2. POST /api/services/:id/assign → { "courier_id": "..." }
3. POST /api/services/:id/status → { "status": "ACCEPTED" }
4. POST /api/services/:id/status → { "status": "IN_TRANSIT" }
5. POST /api/services/:id/evidence → subir evidencia
6. POST /api/services/:id/status → { "status": "DELIVERED" }
7. GET /api/services/:id/history → verificar historial completo
```
