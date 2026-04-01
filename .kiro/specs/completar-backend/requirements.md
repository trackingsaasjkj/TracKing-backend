# Requirements — Completar Backend (15% restante)

## Introducción

El backend está ~85% completo. Todos los módulos funcionales están implementados. Este spec cubre las tres áreas pendientes para llegar al 100%:

1. **Tests reales** — Los archivos en `specs/` son esqueletos de datos estáticos, no tests ejecutables. Hay que convertirlos en suites Jest con unit tests y property-based tests (fast-check).
2. **Bloqueo de cuenta** — La lógica existe pero usa un workaround con la tabla `token`. Hay que agregar una columna `failed_attempts` + `locked_until` al modelo `User` y conectarla correctamente.
3. **Validación de tenant suspendido en login** — El login verifica `user.status` pero no verifica si el `company` del usuario está suspendido (`company.status = false`).

---

## Glosario

- **PBT**: Property-Based Testing con fast-check
- **Unit test**: Test con mocks que verifica un caso concreto
- **Spec esqueleto**: Archivo `.spec.ts` que exporta datos estáticos pero no tiene `describe`/`it` ejecutables
- **Lockout**: Bloqueo temporal de cuenta tras N intentos fallidos

---

## Requirements

### Requirement 1: Tests del módulo Auth

**User Story:** Como desarrollador, quiero tests ejecutables para el módulo de autenticación, para que los cambios futuros no rompan el flujo de login/logout/refresh sin que nos demos cuenta.

#### Acceptance Criteria

1. THE `specs/auth.spec.ts` SHALL contener tests Jest ejecutables (no solo exports de datos).
2. WHEN se ejecuta `npm test`, THE suite de auth SHALL pasar sin errores.
3. THE suite SHALL cubrir: login exitoso, credenciales inválidas, cuenta suspendida, cuenta bloqueada, refresh token válido, refresh token ya usado, logout.
4. THE suite SHALL incluir al menos un property test con fast-check para verificar que cualquier contraseña incorrecta resulta en 401.

---

### Requirement 2: Tests del módulo Servicios

**User Story:** Como desarrollador, quiero tests de la máquina de estados de servicios, para garantizar que las transiciones inválidas siempre son rechazadas.

#### Acceptance Criteria

1. THE `specs/servicios.spec.ts` SHALL reemplazar el export estático con tests Jest ejecutables.
2. THE suite SHALL cubrir todas las transiciones válidas de la máquina de estados.
3. THE suite SHALL cubrir todas las transiciones inválidas (deben lanzar error).
4. THE suite SHALL incluir un property test que verifique que `total_price = delivery_price + product_price` para cualquier par de valores positivos.
5. THE suite SHALL verificar que no se puede marcar DELIVERED sin evidencia previa.

---

### Requirement 3: Tests del módulo Mensajeros

**User Story:** Como desarrollador, quiero tests de los estados operacionales del mensajero, para garantizar que las transiciones de jornada son correctas.

#### Acceptance Criteria

1. THE `specs/mensajeros.spec.ts` SHALL reemplazar el export estático con tests Jest ejecutables.
2. THE suite SHALL cubrir: iniciar jornada (UNAVAILABLE→AVAILABLE), finalizar jornada (AVAILABLE→UNAVAILABLE), bloqueo de finalización con servicios activos.
3. THE suite SHALL incluir un property test que verifique que solo mensajeros AVAILABLE pueden recibir servicios.

---

### Requirement 4: Tests del módulo Liquidaciones

**User Story:** Como desarrollador, quiero tests del cálculo de liquidaciones, para garantizar que la lógica financiera es correcta.

#### Acceptance Criteria

1. THE `specs/liquidaciones.spec.ts` SHALL reemplazar el export estático con tests Jest ejecutables.
2. THE suite SHALL cubrir: cálculo PERCENTAGE, cálculo FIXED, generación sin servicios (error), generación sin regla activa (error).
3. THE suite SHALL incluir un property test que verifique que el cálculo PERCENTAGE siempre produce `delivery_price * (value / 100)` para cualquier precio y porcentaje válidos.
4. THE suite SHALL incluir un property test que verifique que el cálculo FIXED siempre produce el valor fijo independientemente del precio.

---

### Requirement 5: Tests del módulo Planes y Suscripciones

**User Story:** Como desarrollador, quiero tests de las reglas de negocio de planes y suscripciones, para garantizar que el sistema de monetización funciona correctamente.

#### Acceptance Criteria

1. THE `specs/planes-suscripciones.spec.ts` SHALL reemplazar el export estático con tests Jest ejecutables.
2. THE suite SHALL cubrir: crear plan, nombre duplicado (409), desactivar plan, crear suscripción, cancelar suscripción anterior al crear nueva, consultar suscripción activa.
3. THE suite SHALL incluir un property test que verifique que `end_date` siempre es posterior a `start_date`.

---

### Requirement 6: Tests del Super Admin (property-based)

**User Story:** Como desarrollador, quiero los property tests del Super Admin definidos en el design doc, para garantizar las 20 propiedades de correctitud del módulo.

#### Acceptance Criteria

1. THE `specs/super-admin/super-admin-guard.spec.ts` YA ESTÁ implementado — no requiere cambios.
2. THE `specs/super-admin/swagger-auth.middleware.spec.ts` YA ESTÁ implementado — no requiere cambios.
3. THE `specs/super-admin/audit-log.service.spec.ts` YA ESTÁ implementado — no requiere cambios.
4. THE `specs/super-admin/tenants.use-case.spec.ts` SHALL implementar Properties 4, 5, 6 del design doc.
5. THE `specs/super-admin/users.use-case.spec.ts` SHALL implementar Properties 9, 10, 11 del design doc.
6. THE `specs/super-admin/global-config.use-case.spec.ts` SHALL implementar Properties 12, 13, 14 del design doc.

---

### Requirement 7: Bloqueo de cuenta con columnas dedicadas

**User Story:** Como operador de seguridad, quiero que el bloqueo de cuenta use columnas dedicadas en la tabla `user`, para que el mecanismo sea robusto y no dependa de un workaround con la tabla `token`.

#### Acceptance Criteria

1. THE modelo `User` en Prisma SHALL agregar los campos `failed_attempts Int @default(0)` y `locked_until DateTime?`.
2. WHEN un login falla, THE sistema SHALL incrementar `failed_attempts` en 1.
3. WHEN `failed_attempts >= 5`, THE sistema SHALL establecer `locked_until = now() + 1 hora`.
4. WHEN se hace login y `locked_until > now()`, THE sistema SHALL responder con HTTP 429.
5. WHEN un login es exitoso, THE sistema SHALL resetear `failed_attempts = 0` y `locked_until = null`.
6. THE migración Prisma SHALL generarse y aplicarse sin pérdida de datos.

---

### Requirement 8: Verificación de tenant suspendido en login

**User Story:** Como operador, quiero que el login rechace usuarios de empresas suspendidas, para que la suspensión de un tenant tenga efecto inmediato en todos sus usuarios.

#### Acceptance Criteria

1. WHEN un usuario intenta hacer login y su `company.status = false`, THE sistema SHALL responder con HTTP 403 y mensaje "Empresa suspendida".
2. THE verificación SHALL ocurrir en `LoginUseCase` después de encontrar el usuario y antes de verificar la contraseña.
3. THE `AuthRepository.findUserByEmail` SHALL hacer join con `company` para obtener `company.status`.
4. WHEN el usuario es `SUPER_ADMIN` (company_id = null), THE verificación de empresa SHALL omitirse.
