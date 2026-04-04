# FASE 2 — Gestión de Servicios (Core)

## Objetivo
Implementar el ciclo de vida completo de un servicio de mensajería con máquina de estados validada, gestión de método de pago y seguimiento de liquidación.

## Arquitectura

```
src/modules/servicios/
├── domain/
│   ├── state-machine/servicio.machine.ts
│   └── rules/
│       ├── validar-transicion.rule.ts
│       ├── validar-asignacion.rule.ts
│       ├── validar-entrega.rule.ts
│       ├── validar-precio.rule.ts
│       └── validar-pago.rule.ts          ← nuevo
├── infrastructure/repositories/
│   ├── servicio.repository.ts
│   ├── courier.repository.ts
│   ├── historial.repository.ts
│   └── evidence.repository.ts
├── application/
│   ├── dto/
│   │   ├── crear-servicio.dto.ts
│   │   ├── asignar-servicio.dto.ts
│   │   ├── cambiar-estado.dto.ts
│   │   └── cambiar-pago.dto.ts           ← nuevo
│   └── use-cases/
│       ├── crear-servicio.use-case.ts
│       ├── asignar-servicio.use-case.ts
│       ├── cambiar-estado.use-case.ts
│       ├── cambiar-pago.use-case.ts      ← nuevo
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
| POST | `/api/services/:id/payment` | ADMIN, AUX, COURIER | Cambiar estado de pago |
| GET | `/api/services` | Todos | Listar (filtros: status, courier_id) |
| GET | `/api/services/:id` | Todos | Obtener por ID |
| GET | `/api/services/:id/history` | Todos | Historial de estados |

## Campos de pago

### Enums

```
PaymentMethod: EFECTIVO | TRANSFERENCIA | CREDITO
PaymentStatus: PAGADO | NO_PAGADO
```

### Lógica automática al crear

| payment_method | payment_status asignado |
|----------------|------------------------|
| EFECTIVO | PAGADO |
| TRANSFERENCIA | PAGADO |
| CREDITO | NO_PAGADO |

### Lógica al cambiar estado de pago

| Acción | payment_status | payment_method |
|--------|---------------|----------------|
| Marcar NO_PAGADO | NO_PAGADO | CREDITO |
| Marcar PAGADO | PAGADO | EFECTIVO |

### Is Settled

El campo `is_settled` se marca `true` automáticamente al generar una liquidación (courier o cliente) que incluye el servicio. Permite saber si un servicio ya fue contabilizado en una liquidación.

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
- `payment_status` se calcula automáticamente al crear según `payment_method`
- Historial registrado en **cada** cambio de estado
- Al asignar: mensajero pasa a `IN_SERVICE`
- Al entregar o cancelar: mensajero vuelve a `AVAILABLE`
- Solo 1 mensajero por servicio
- Todas las queries scoped por `company_id`

## Flujo de prueba (Swagger)

```
1. POST /api/services → crear servicio con payment_method: EFECTIVO
2. POST /api/services/:id/assign → { "courier_id": "..." }
3. POST /api/services/:id/status → { "status": "ACCEPTED" }
4. POST /api/services/:id/status → { "status": "IN_TRANSIT" }
5. POST /api/services/:id/evidence → subir evidencia (multipart)
6. POST /api/services/:id/payment → { "payment_status": "NO_PAGADO" }  ← opcional
7. POST /api/services/:id/status → { "status": "DELIVERED" }
8. GET /api/services/:id/history → verificar historial completo
```
