# Design Document — Completar Backend (15% restante)

## Overview

Este documento describe los cambios técnicos necesarios para completar el backend. Se divide en dos categorías:

1. **Cambios de código** (Req 7 y 8): modificaciones al schema Prisma y al flujo de login.
2. **Tests** (Req 1–6): conversión de specs estáticos a suites Jest ejecutables con unit tests y property-based tests.

---

## Arquitectura de tests

### Patrón general para cada spec

Cada spec sigue el mismo patrón: mock del repositorio con `jest.fn()`, instanciación directa del use case, y assertions sobre el resultado o las excepciones lanzadas.

```
describe('NombreUseCase', () => {
  let useCase: NombreUseCase;
  let mockRepo: jest.Mocked<NombreRepository>;

  beforeEach(() => {
    mockRepo = { metodo: jest.fn() } as any;
    useCase = new NombreUseCase(mockRepo);
  });

  it('caso concreto', async () => { ... });

  it('P-N: property description', () => {
    fc.assert(fc.property(...), { numRuns: 100 });
  });
});
```

### Ubicación de archivos

```
specs/
├── auth.spec.ts                          ← nuevo (Req 1)
├── servicios.spec.ts                     ← reemplazar export estático (Req 2)
├── mensajeros.spec.ts                    ← reemplazar export estático (Req 3)
├── liquidaciones.spec.ts                 ← reemplazar export estático (Req 4)
├── planes-suscripciones.spec.ts          ← reemplazar export estático (Req 5)
└── super-admin/
    ├── super-admin-guard.spec.ts         ← ya implementado ✅
    ├── swagger-auth.middleware.spec.ts   ← ya implementado ✅
    ├── audit-log.service.spec.ts         ← ya implementado ✅
    ├── tenants.use-case.spec.ts          ← nuevo (Req 6)
    ├── users.use-case.spec.ts            ← nuevo (Req 6)
    └── global-config.use-case.spec.ts   ← nuevo (Req 6)
```

---

## Cambios al schema Prisma (Req 7)

```prisma
model User {
  // ... campos existentes ...
  failed_attempts Int       @default(0)
  locked_until    DateTime?
}
```

Migración: `npx prisma migrate dev --name add-lockout-fields`

---

## Cambios al LoginUseCase (Req 7 y 8)

### Lógica de lockout actualizada

```typescript
// Reemplaza el workaround con token_hash: 'FAILED_ATTEMPT'
const user = await this.authRepo.findUserByEmailWithCompany(dto.email);

// Req 8: verificar empresa suspendida
if (user.company && !user.company.status) {
  throw new AppException('Empresa suspendida', HttpStatus.FORBIDDEN);
}

// Req 7: verificar lockout con columna dedicada
if (user.locked_until && user.locked_until > new Date()) {
  throw new AppException('Cuenta bloqueada temporalmente', HttpStatus.TOO_MANY_REQUESTS);
}

const valid = await this.tokenService.comparePassword(dto.password, user.password_hash);
if (!valid) {
  await this.authRepo.incrementFailedAttempts(user.id);  // ahora real
  throw new UnauthorizedException('Credenciales inválidas');
}

// Login exitoso: resetear contador
await this.authRepo.resetFailedAttempts(user.id);
```

### Métodos nuevos en AuthRepository

```typescript
findUserByEmailWithCompany(email: string): Promise<User & { company: Company | null }>
incrementFailedAttempts(userId: string): Promise<void>  // ahora con columna real
resetFailedAttempts(userId: string): Promise<void>
```

---

## Cobertura de tests por módulo

### Auth (specs/auth.spec.ts)

| Test | Tipo | Descripción |
|------|------|-------------|
| login exitoso | Unit | Retorna tokens y datos del usuario |
| credenciales inválidas | Unit | Lanza UnauthorizedException |
| cuenta suspendida | Unit | Lanza AppException 403 |
| empresa suspendida | Unit | Lanza AppException 403 |
| cuenta bloqueada | Unit | Lanza AppException 429 |
| login exitoso resetea contador | Unit | failed_attempts = 0 |
| refresh token válido | Unit | Retorna nuevos tokens |
| refresh token ya usado | Unit | Lanza UnauthorizedException |
| logout revoca tokens | Unit | Llama revokeAllUserTokens |
| P: contraseña incorrecta → 401 | PBT | fc.string() como password |

### Servicios (specs/servicios.spec.ts)

| Test | Tipo | Descripción |
|------|------|-------------|
| crear servicio válido | Unit | total_price calculado correctamente |
| transición PENDING→ASSIGNED | Unit | Mensajero pasa a IN_SERVICE |
| transición ASSIGNED→ACCEPTED | Unit | OK |
| transición ACCEPTED→IN_TRANSIT | Unit | OK |
| transición IN_TRANSIT→DELIVERED sin evidencia | Unit | Lanza error |
| transición IN_TRANSIT→DELIVERED con evidencia | Unit | OK |
| cancelar desde PENDING | Unit | OK |
| cancelar desde DELIVERED | Unit | Lanza error |
| P: total_price = delivery + product | PBT | fc.float() positivos |
| P: transiciones inválidas siempre lanzan error | PBT | fc.constantFrom(estados inválidos) |

### Mensajeros (specs/mensajeros.spec.ts)

| Test | Tipo | Descripción |
|------|------|-------------|
| iniciar jornada desde UNAVAILABLE | Unit | → AVAILABLE |
| iniciar jornada desde AVAILABLE | Unit | Lanza error |
| finalizar jornada desde AVAILABLE sin servicios | Unit | → UNAVAILABLE |
| finalizar jornada con servicios activos | Unit | Lanza error |
| P: solo AVAILABLE puede recibir servicios | PBT | fc.constantFrom(UNAVAILABLE, IN_SERVICE) → error |

### Liquidaciones (specs/liquidaciones.spec.ts)

| Test | Tipo | Descripción |
|------|------|-------------|
| calcular PERCENTAGE | Unit | delivery_price * (value/100) |
| calcular FIXED | Unit | valor fijo independiente del precio |
| generar sin servicios | Unit | Lanza error |
| generar sin regla activa | Unit | Lanza error |
| P: PERCENTAGE siempre = precio * (value/100) | PBT | fc.float() positivos |
| P: FIXED siempre = value | PBT | fc.float() positivos |

### Planes y Suscripciones (specs/planes-suscripciones.spec.ts)

| Test | Tipo | Descripción |
|------|------|-------------|
| crear plan válido | Unit | Retorna plan con id |
| nombre duplicado | Unit | Lanza AppException 409 |
| desactivar plan | Unit | active = false |
| crear suscripción | Unit | status = ACTIVE |
| crear suscripción cancela anterior | Unit | anterior → CANCELLED |
| end_date default = start + 1 mes | Unit | Calculado correctamente |
| P: end_date siempre > start_date | PBT | fc.date() para start, verificar end |

### Super Admin — Tenants (specs/super-admin/tenants.use-case.spec.ts)

| Test | Tipo | Propiedad |
|------|------|-----------|
| crear tenant válido retorna id | Unit + PBT | P4 |
| nombre duplicado → 409 | Unit + PBT | P5 |
| suspend → reactivate → status=true | Unit + PBT | P6 |

### Super Admin — Users (specs/super-admin/users.use-case.spec.ts)

| Test | Tipo | Propiedad |
|------|------|-----------|
| suspend → reactivate → ACTIVE | Unit + PBT | P9 |
| cambio de rol persiste | Unit + PBT | P10 |
| SUPER_ADMIN con company_id → 422 | Unit + PBT | P11 |

### Super Admin — GlobalConfig (specs/super-admin/global-config.use-case.spec.ts)

| Test | Tipo | Propiedad |
|------|------|-----------|
| update persiste valor | Unit + PBT | P12 |
| update key inexistente → 404 | Unit + PBT | P13 |
| create key duplicada → 409 | Unit + PBT | P14 |
