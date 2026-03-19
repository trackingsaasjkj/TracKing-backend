# FASE 3 — Mensajeros y Operación

## Objetivo
Gestionar disponibilidad, jornadas y operación de mensajeros.

## Arquitectura

```
src/modules/mensajeros/
├── domain/
│   ├── mensajero.machine.ts
│   └── rules/validar-jornada.rule.ts
├── infrastructure/
│   └── mensajero.repository.ts
├── application/
│   ├── dto/
│   │   ├── create-mensajero.dto.ts
│   │   └── update-mensajero.dto.ts
│   └── use-cases/
│       ├── crear-mensajero.use-case.ts
│       ├── consultar-mensajeros.use-case.ts
│       ├── jornada.use-case.ts
│       └── update-mensajero.use-case.ts
├── mensajeros.controller.ts
└── mensajeros.module.ts
```

## Endpoints

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| POST | `/api/mensajeros` | ADMIN | Crear perfil de mensajero |
| GET | `/api/mensajeros` | ADMIN, AUX | Listar todos |
| GET | `/api/mensajeros/activos` | ADMIN, AUX | Solo AVAILABLE |
| GET | `/api/mensajeros/me/services` | COURIER | Mis servicios |
| POST | `/api/mensajeros/start` | COURIER | Iniciar jornada |
| POST | `/api/mensajeros/end` | COURIER | Finalizar jornada |
| GET | `/api/mensajeros/:id` | ADMIN, AUX | Obtener por ID |
| PUT | `/api/mensajeros/:id` | ADMIN | Actualizar datos |

## Estados operacionales

```
UNAVAILABLE ──→ AVAILABLE ──→ IN_SERVICE
                    ↑               │
                    └───────────────┘
```

| Transición | Trigger |
|------------|---------|
| UNAVAILABLE → AVAILABLE | Mensajero inicia jornada |
| AVAILABLE → IN_SERVICE | Sistema al asignar servicio |
| IN_SERVICE → AVAILABLE | Sistema al entregar/cancelar servicio |
| AVAILABLE → UNAVAILABLE | Mensajero finaliza jornada |

## Reglas de negocio

- Solo mensajeros `AVAILABLE` pueden recibir servicios
- No se puede finalizar jornada con servicios en estado ASSIGNED, ACCEPTED o IN_TRANSIT
- No se puede finalizar jornada desde `IN_SERVICE` directamente
- El mensajero solo ve sus propios servicios (`GET /me/services`)
- Un usuario solo puede tener un perfil de mensajero

## Flujo de prueba (Swagger)

```
1. POST /api/auth/login (con usuario COURIER)
2. POST /api/mensajeros/start → iniciar jornada
3. [Admin asigna servicio al mensajero]
4. GET /api/mensajeros/me/services → ver mis servicios
5. POST /api/services/:id/status → { "status": "ACCEPTED" }
6. POST /api/services/:id/status → { "status": "IN_TRANSIT" }
7. [Subir evidencia]
8. POST /api/services/:id/status → { "status": "DELIVERED" }
9. POST /api/mensajeros/end → finalizar jornada
```
