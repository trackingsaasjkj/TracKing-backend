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
| GET | `/api/mensajeros/:id` | ADMIN, AUX | Obtener por ID |
| PUT | `/api/mensajeros/:id` | ADMIN | Actualizar datos |

> Las operaciones del mensajero (jornada, servicios, ubicación) están en el módulo [Courier Mobile](./fase-courier-mobile.md) bajo `/api/courier`.

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
- Se puede iniciar jornada desde `IN_SERVICE` (pedidos activos de sesión anterior) — el estado no cambia, el mensajero ya está operativo

## Cambios recientes

### Inicio de jornada desde IN_SERVICE (Abril 2026)

**Problema:** Si un mensajero tenía pedidos activos de una sesión anterior, su estado era `IN_SERVICE`. Al intentar iniciar jornada, el backend rechazaba con `400` porque la regla solo permitía `UNAVAILABLE`.

**Solución:**

`validar-jornada.rule.ts` — `validarInicioJornada` ahora acepta `UNAVAILABLE` e `IN_SERVICE`:

```ts
export function validarInicioJornada(estado: MensajeroEstado): void {
  if (estado !== 'UNAVAILABLE' && estado !== 'IN_SERVICE') {
    throw new AppException(`No se puede iniciar jornada desde estado ${estado}`);
  }
}
```

`jornada.use-case.ts` — `iniciar()` solo transiciona a `AVAILABLE` si viene de `UNAVAILABLE`. Si ya está `IN_SERVICE`, retorna el perfil sin cambiar el estado:

```ts
if (mensajero.operational_status === 'UNAVAILABLE') {
  await this.mensajeroRepo.updateStatus(courier_id, company_id, 'AVAILABLE');
}
return this.mensajeroRepo.findById(courier_id, company_id);
```

## Flujo de prueba (Swagger)

```
1. POST /api/auth/login (con usuario ADMIN)
2. POST /api/mensajeros → crear perfil de mensajero
3. GET  /api/mensajeros → listar mensajeros
4. GET  /api/mensajeros/activos → ver disponibles
5. PUT  /api/mensajeros/:id → actualizar datos
```

> Para el flujo operativo del mensajero (jornada, servicios, evidencias) ver [fase-courier-mobile.md](./fase-courier-mobile.md).
