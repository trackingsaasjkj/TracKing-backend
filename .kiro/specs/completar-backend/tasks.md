# Implementation Plan — Completar Backend (15% restante)

## Overview

Plan incremental para completar el backend. Las tareas están ordenadas por dependencia: primero los cambios de infraestructura (schema, login), luego los tests de módulos de negocio, y finalmente los tests del Super Admin.

Tiempo estimado total: ~12-16 horas de desarrollo.

---

## Tasks

- [x] 1. Migración Prisma — campos de lockout en User
  - [x] 1.1 Agregar `failed_attempts Int @default(0)` al modelo `User` en `prisma/schema.prisma`
  - [x] 1.2 Agregar `locked_until DateTime?` al modelo `User` en `prisma/schema.prisma`
  - [x] 1.3 Ejecutar `npx prisma migrate dev --name add-lockout-fields`
  - [x] 1.4 Ejecutar `npx prisma generate`
  - _Requirements: 7.1, 7.6_

- [x] 2. Actualizar AuthRepository — lockout real y join con company
  - [x] 2.1 Agregar método `findUserByEmailWithCompany(email)` que hace include de `company` (solo `id`, `status`)
  - [x] 2.2 Reemplazar `incrementFailedAttempts` con implementación real: si `failed_attempts + 1 >= 5`, setear `locked_until = now() + 1h`; siempre incrementar `failed_attempts`
  - [x] 2.3 Agregar método `resetFailedAttempts(userId)` que setea `failed_attempts = 0, locked_until = null`
  - [x] 2.4 Mantener `countRecentFailedLogins` por compatibilidad pero marcar como deprecated
  - _Requirements: 7.2, 7.3, 8.3_

- [x] 3. Actualizar LoginUseCase — lockout real y verificación de empresa
  - [x] 3.1 Cambiar llamada de `findUserByEmail` a `findUserByEmailWithCompany`
  - [x] 3.2 Agregar verificación: si `user.company && !user.company.status` → AppException 403 "Empresa suspendida"
  - [x] 3.3 Reemplazar lógica de lockout basada en tokens por: `if (user.locked_until && user.locked_until > new Date())` → AppException 429
  - [x] 3.4 En rama de contraseña inválida: llamar `authRepo.incrementFailedAttempts(user.id)` (real)
  - [x] 3.5 En login exitoso: llamar `authRepo.resetFailedAttempts(user.id)`
  - [x] 3.6 Omitir verificación de empresa cuando `user.company_id === null` (SUPER_ADMIN)
  - _Requirements: 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.4_

- [x] 4. Tests de Auth — `specs/auth.spec.ts`
  - [x] 4.1 Crear mock de `AuthRepository` con todos los métodos necesarios
  - [x] 4.2 Crear mock de `TokenService`
  - [x] 4.3 Unit test: login exitoso retorna `{ accessToken, refreshToken, user }`
  - [x] 4.4 Unit test: email no encontrado → UnauthorizedException
  - [x] 4.5 Unit test: contraseña incorrecta → UnauthorizedException + llama incrementFailedAttempts
  - [x] 4.6 Unit test: `user.status = SUSPENDED` → AppException 403
  - [x] 4.7 Unit test: `company.status = false` → AppException 403 "Empresa suspendida"
  - [x] 4.8 Unit test: `locked_until > now()` → AppException 429
  - [x] 4.9 Unit test: login exitoso llama `resetFailedAttempts`
  - [x] 4.10 Unit test: refresh token válido retorna nuevos tokens
  - [x] 4.11 Unit test: refresh token ya usado → UnauthorizedException
  - [x] 4.12 Unit test: logout llama `revokeAllUserTokens`
  - [x] 4.13 PBT: `fc.string()` como password → siempre UnauthorizedException cuando no coincide con hash
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 5. Tests de Servicios — `specs/servicios.spec.ts`
  - [x] 5.1 Reemplazar el export estático con suite Jest
  - [x] 5.2 Mock de `ServicioRepository`, `CourierRepository`, `EvidenceRepository`
  - [x] 5.3 Unit test: crear servicio → `total_price = delivery_price + product_price`
  - [x] 5.4 Unit test: transición PENDING→ASSIGNED con mensajero AVAILABLE → OK
  - [x] 5.5 Unit test: transición PENDING→ASSIGNED con mensajero IN_SERVICE → error
  - [x] 5.6 Unit test: transición ASSIGNED→ACCEPTED → OK
  - [x] 5.7 Unit test: transición ACCEPTED→IN_TRANSIT → OK
  - [x] 5.8 Unit test: transición IN_TRANSIT→DELIVERED sin evidencia → error
  - [x] 5.9 Unit test: transición IN_TRANSIT→DELIVERED con evidencia → OK
  - [x] 5.10 Unit test: cancelar desde PENDING → OK, libera mensajero si había
  - [x] 5.11 Unit test: cancelar desde DELIVERED → error
  - [x] 5.12 PBT: `fc.float({ min: 0 })` para precios → `total = delivery + product`
  - [x] 5.13 PBT: transiciones inválidas siempre lanzan error
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 6. Tests de Mensajeros — `specs/mensajeros.spec.ts`
  - [x] 6.1 Reemplazar el export estático con suite Jest
  - [x] 6.2 Mock de `MensajeroRepository`
  - [x] 6.3 Unit test: `JornadaUseCase.iniciar` desde UNAVAILABLE → AVAILABLE
  - [x] 6.4 Unit test: `JornadaUseCase.iniciar` desde AVAILABLE → error
  - [x] 6.5 Unit test: `JornadaUseCase.finalizar` desde AVAILABLE sin servicios activos → UNAVAILABLE
  - [x] 6.6 Unit test: `JornadaUseCase.finalizar` con servicios ASSIGNED/ACCEPTED/IN_TRANSIT → error
  - [x] 6.7 Unit test: `JornadaUseCase.finalizar` desde IN_SERVICE → error
  - [x] 6.8 PBT: `fc.constantFrom('UNAVAILABLE', 'IN_SERVICE')` → asignación siempre falla
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 7. Tests de Liquidaciones — `specs/liquidaciones.spec.ts`
  - [x] 7.1 Reemplazar el export estático con suite Jest
  - [x] 7.2 Mock de `LiquidacionRepository`
  - [x] 7.3 Unit test: calcular con regla PERCENTAGE → `delivery_price * (value / 100)`
  - [x] 7.4 Unit test: calcular con regla FIXED → `value` independiente del precio
  - [x] 7.5 Unit test: generar liquidación sin servicios DELIVERED en rango → error
  - [x] 7.6 Unit test: generar liquidación sin regla activa → error
  - [x] 7.7 Unit test: servicios ya liquidados no se incluyen en nueva liquidación
  - [x] 7.8 PBT: `fc.float({ min: 1, max: 100000 })` para precio, `fc.float({ min: 1, max: 100 })` para porcentaje → resultado = precio * (pct/100)
  - [x] 7.9 PBT: regla FIXED con cualquier precio → resultado siempre = value
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 8. Tests de Planes y Suscripciones — `specs/planes-suscripciones.spec.ts`
  - [x] 8.1 Reemplazar el export estático con suite Jest
  - [x] 8.2 Mock de `PlanesRepository` y `SuscripcionesRepository`
  - [x] 8.3 Unit test: crear plan válido → retorna plan con id
  - [x] 8.4 Unit test: crear plan con nombre duplicado → AppException 409
  - [x] 8.5 Unit test: desactivar plan → `active = false`
  - [x] 8.6 Unit test: crear suscripción → `status = ACTIVE`
  - [x] 8.7 Unit test: crear suscripción cuando ya existe una activa → cancela la anterior
  - [x] 8.8 Unit test: `end_date` no provisto → calculado como `start_date + 1 mes`
  - [x] 8.9 Unit test: cancelar suscripción → `status = CANCELLED`
  - [x] 8.10 PBT: `fc.date()` para start_date → end_date siempre > start_date
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 9. Tests Super Admin — Tenants (`specs/super-admin/tenants.use-case.spec.ts`)
  - [x] 9.1 Crear mock de `SuperAdminRepository` y `AuditLogService`
  - [x] 9.2 Unit test: `CreateTenantUseCase` con nombre válido → retorna tenant con id
  - [x] 9.3 Unit test: `CreateTenantUseCase` con nombre duplicado → AppException 409
  - [x] 9.4 Unit test: `SuspendTenantUseCase` → `status = false`
  - [x] 9.5 Unit test: `ReactivateTenantUseCase` → `status = true`
  - [x] 9.6 Unit test: `DeleteTenantUseCase` → llama `auditLogService.log` con `action: 'DELETE_TENANT'`
  - [x] 9.7 PBT P4: `fc.string({ minLength: 1, maxLength: 100 })` → crear tenant siempre retorna id
  - [x] 9.8 PBT P5: nombre duplicado siempre → AppException 409
  - [x] 9.9 PBT P6: suspend → reactivate → `status = true`
  - _Requirements: 6.4_

- [x] 10. Tests Super Admin — Users (`specs/super-admin/users.use-case.spec.ts`)
  - [x] 10.1 Crear mock de `SuperAdminRepository` y `AuditLogService`
  - [x] 10.2 Unit test: `SuspendUserUseCase` → `status = SUSPENDED`
  - [x] 10.3 Unit test: `ReactivateUserUseCase` → `status = ACTIVE`
  - [x] 10.4 Unit test: `ChangeUserRoleUseCase` con rol válido → persiste nuevo rol
  - [x] 10.5 Unit test: `ChangeUserRoleUseCase` con `SUPER_ADMIN` y `company_id != null` → AppException 422
  - [x] 10.6 Unit test: `DeleteUserUseCase` → llama `auditLogService.log` con `action: 'DELETE_USER'`
  - [x] 10.7 PBT P9: suspend → reactivate → `status = ACTIVE`
  - [x] 10.8 PBT P10: `fc.constantFrom(Role.ADMIN, Role.AUX, Role.COURIER)` → rol persiste
  - [x] 10.9 PBT P11: `fc.uuid()` como company_id + rol SUPER_ADMIN → AppException 422
  - _Requirements: 6.5_

- [x] 11. Tests Super Admin — GlobalConfig (`specs/super-admin/global-config.use-case.spec.ts`)
  - [x] 11.1 Crear mock de `SuperAdminRepository`
  - [x] 11.2 Unit test: `CreateGlobalConfigUseCase` con key válida → retorna config con id
  - [x] 11.3 Unit test: `CreateGlobalConfigUseCase` con key duplicada → AppException 409
  - [x] 11.4 Unit test: `UpdateGlobalConfigUseCase` con key existente → persiste nuevo valor
  - [x] 11.5 Unit test: `UpdateGlobalConfigUseCase` con key inexistente → AppException 404
  - [x] 11.6 PBT P12: `fc.string()` como value → update siempre persiste el valor enviado
  - [x] 11.7 PBT P13: `fc.string()` como key inexistente → siempre AppException 404
  - [x] 11.8 PBT P14: key duplicada → siempre AppException 409
  - _Requirements: 6.6_

- [x] 12. Checkpoint final — Ejecutar toda la suite
  - [x] 12.1 Ejecutar `npm test -- --passWithNoTests` y verificar que todos los tests pasan
  - [x] 12.2 Verificar que no hay regresiones en los specs ya implementados (super-admin-guard, swagger-auth, audit-log)
  - [x] 12.3 Ejecutar `npm run build` para verificar que los cambios de schema no rompen la compilación

## Notes

- Los specs de `servicios`, `mensajeros`, `liquidaciones` y `planes-suscripciones` actualmente exportan objetos de datos estáticos — hay que reemplazarlos completamente con suites Jest.
- Los 3 specs de super-admin ya implementados (`super-admin-guard`, `swagger-auth`, `audit-log`) NO deben modificarse.
- La migración de lockout (tarea 1) debe hacerse antes de las tareas 2 y 3 para que TypeScript compile correctamente.
- Los mocks deben ser lo más simples posible — no usar `@nestjs/testing` ni levantar el módulo completo, solo instanciación directa con `jest.fn()`.
- Cada PBT debe correr con `{ numRuns: 100 }` mínimo.
