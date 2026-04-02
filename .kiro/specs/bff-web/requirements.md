# Requirements Document

## Introduction

El módulo `bff-web` es un Backend for Frontend orientado al panel web de TracKing. Su propósito es consolidar múltiples llamadas internas en un único endpoint por vista, reduciendo la latencia percibida y simplificando la lógica del frontend. El módulo orquesta use-cases existentes de los módulos `Servicios`, `Mensajeros`, `Reportes` y `Liquidaciones`, ejecutando las consultas en paralelo con `Promise.all`. No tiene repositorio propio ni accede a Prisma directamente.

## Glossary

- **BffWeb**: El módulo Backend for Frontend que expone endpoints agregados para el panel web.
- **Controller**: Componente NestJS que recibe las peticiones HTTP y delega en los use-cases del BFF.
- **Use_Case**: Clase de aplicación que orquesta llamadas a use-cases de otros módulos.
- **JwtAuthGuard**: Guard global de NestJS que valida el token JWT en cada petición no pública.
- **RolesGuard**: Guard que verifica que el rol del usuario autenticado esté autorizado para el endpoint.
- **JwtPayload**: Objeto decodificado del JWT que contiene `company_id`, `sub`, `role` y otros campos del usuario.
- **company_id**: Identificador de la empresa extraído del JWT, nunca de query params.
- **ADMIN**: Rol con acceso completo al panel web, incluyendo liquidaciones.
- **AUX**: Rol auxiliar con acceso a dashboard, pedidos activos y reportes, pero no a liquidaciones.
- **ConsultarServiciosUseCase**: Use-case del módulo Servicios que expone `findAll(company_id, filters?)`.
- **ConsultarMensajerosUseCase**: Use-case del módulo Mensajeros que expone `findActivos(company_id)`.
- **ReporteServiciosUseCase**: Use-case del módulo Reportes que genera el reporte de servicios por período.
- **ReporteFinancieroUseCase**: Use-case del módulo Reportes que genera el reporte financiero por período.
- **ConsultarLiquidacionesUseCase**: Use-case del módulo Liquidaciones que expone `getEarnings(company_id, courier_id?)`.
- **GestionarReglasUseCase**: Use-case del módulo Liquidaciones que expone `findActive(company_id)`.
- **BffReportsQueryDto**: DTO que transporta los parámetros `from` y `to` para el endpoint de reportes.
- **BffSettlementsQueryDto**: DTO que transporta el parámetro opcional `courier_id` para el endpoint de liquidaciones.
- **AppException**: Excepción de dominio que produce respuestas HTTP con `{ success: false, error: message }`.

---

## Requirements

### Requirement 1: Autenticación y autorización en todos los endpoints BFF

**User Story:** Como desarrollador del frontend, quiero que todos los endpoints BFF estén protegidos por JWT y roles, para que solo usuarios autenticados con el rol correcto puedan acceder a los datos consolidados.

#### Acceptance Criteria

1. THE `JwtAuthGuard` SHALL aplicarse globalmente a todos los endpoints del `BffWeb` a través del guard global registrado en `AppModule`.
2. THE `Controller` SHALL aplicar `RolesGuard` a nivel de clase para que todos sus endpoints requieran verificación de rol.
3. WHEN un usuario sin token JWT válido realiza una petición a cualquier endpoint del `BffWeb`, THEN THE `JwtAuthGuard` SHALL rechazar la petición con HTTP 401.
4. WHEN un usuario autenticado con un rol no autorizado accede a un endpoint del `BffWeb`, THEN THE `RolesGuard` SHALL rechazar la petición con HTTP 403.
5. THE `Controller` SHALL extraer el `company_id` exclusivamente del `JwtPayload`, nunca de query params ni body.

---

### Requirement 2: Registro del módulo BffWeb en la aplicación

**User Story:** Como desarrollador backend, quiero que `BffWebModule` esté registrado en `AppModule`, para que los endpoints BFF sean accesibles al iniciar la aplicación.

#### Acceptance Criteria

1. THE `AppModule` SHALL importar `BffWebModule` en su lista de imports.
2. THE `BffWebModule` SHALL importar `ServiciosModule`, `MensajerosModule`, `ReportesModule` y `LiquidacionesModule` para acceder a sus use-cases exportados.
3. THE `BffWebModule` SHALL declarar `BffDashboardUseCase`, `BffActiveOrdersUseCase`, `BffReportsUseCase` y `BffSettlementsUseCase` como providers.

---

### Requirement 3: Endpoint GET /api/bff/dashboard

**User Story:** Como usuario con rol ADMIN o AUX, quiero obtener en una sola llamada los servicios pendientes, los mensajeros activos y el reporte financiero del día, para construir el panel principal sin múltiples peticiones.

#### Acceptance Criteria

1. WHEN un usuario con rol `ADMIN` o `AUX` realiza `GET /api/bff/dashboard`, THE `BffDashboardUseCase` SHALL ejecutar en paralelo `ConsultarServiciosUseCase.findAll(company_id, { status: 'PENDING' })`, `ConsultarMensajerosUseCase.findActivos(company_id)` y `ReporteFinancieroUseCase.execute({ from: hoy, to: hoy_23:59:59 }, company_id)`.
2. WHEN las tres consultas internas se completan exitosamente, THE `Controller` SHALL retornar HTTP 200 con un objeto que contiene `pending_services`, `active_couriers` y `today_financial`.
3. THE `BffDashboardUseCase` SHALL calcular la fecha de hoy en formato `YYYY-MM-DD` en tiempo de ejecución, sin recibirla como parámetro externo.
4. IF alguna consulta interna lanza una excepción, THEN THE `BffDashboardUseCase` SHALL propagar la excepción sin suprimirla.

---

### Requirement 4: Endpoint GET /api/bff/active-orders

**User Story:** Como usuario con rol ADMIN o AUX, quiero obtener en una sola llamada todos los servicios y los mensajeros disponibles, para gestionar la asignación de pedidos activos sin múltiples peticiones.

#### Acceptance Criteria

1. WHEN un usuario con rol `ADMIN` o `AUX` realiza `GET /api/bff/active-orders`, THE `BffActiveOrdersUseCase` SHALL ejecutar en paralelo `ConsultarServiciosUseCase.findAll(company_id)` y `ConsultarMensajerosUseCase.findActivos(company_id)`.
2. WHEN las dos consultas internas se completan exitosamente, THE `Controller` SHALL retornar HTTP 200 con un objeto que contiene `services` y `available_couriers`.
3. IF alguna consulta interna lanza una excepción, THEN THE `BffActiveOrdersUseCase` SHALL propagar la excepción sin suprimirla.

---

### Requirement 5: Endpoint GET /api/bff/reports con validación de rango de fechas

**User Story:** Como usuario con rol ADMIN o AUX, quiero obtener en una sola llamada el reporte de servicios y el reporte financiero para un período dado, para analizar el rendimiento sin múltiples peticiones.

#### Acceptance Criteria

1. WHEN un usuario con rol `ADMIN` o `AUX` realiza `GET /api/bff/reports` con `from` y `to` válidos, THE `BffReportsUseCase` SHALL ejecutar en paralelo `ReporteServiciosUseCase.execute(query, company_id)` y `ReporteFinancieroUseCase.execute(query, company_id)`.
2. WHEN las dos consultas internas se completan exitosamente, THE `Controller` SHALL retornar HTTP 200 con un objeto que contiene `services` y `financial`.
3. THE `BffReportsQueryDto` SHALL declarar `from` y `to` como campos obligatorios con `@IsNotEmpty()` y `@IsDateString()`, de modo que la validación ocurra en la capa de DTO antes de llegar al use-case.
4. IF la petición llega al `BffReportsUseCase` con `from` o `to` ausentes, THEN THE `BffReportsUseCase` SHALL lanzar una `AppException` con HTTP 400 y el mensaje `'Los parámetros from y to son obligatorios'`.
5. IF `from` es mayor o igual a `to` en valor de fecha, THEN THE `BffReportsUseCase` SHALL lanzar una `AppException` con HTTP 400 y un mensaje descriptivo.
6. THE `BffReportsQueryDto` SHALL exponer `from` y `to` en la documentación Swagger como parámetros requeridos con ejemplos de formato ISO date.

---

### Requirement 6: Endpoint GET /api/bff/settlements

**User Story:** Como usuario con rol ADMIN, quiero obtener en una sola llamada los mensajeros activos, la regla de liquidación activa y el resumen de ganancias, para gestionar las liquidaciones sin múltiples peticiones.

#### Acceptance Criteria

1. WHEN un usuario con rol `ADMIN` realiza `GET /api/bff/settlements`, THE `BffSettlementsUseCase` SHALL ejecutar en paralelo `ConsultarMensajerosUseCase.findActivos(company_id)`, `GestionarReglasUseCase.findActive(company_id)` y `ConsultarLiquidacionesUseCase.getEarnings(company_id, courier_id?)`.
2. WHEN las tres consultas internas se completan exitosamente, THE `Controller` SHALL retornar HTTP 200 con un objeto que contiene `couriers`, `active_rule` y `earnings`.
3. WHERE el parámetro `courier_id` es proporcionado en el query, THE `BffSettlementsUseCase` SHALL pasar `courier_id` a `ConsultarLiquidacionesUseCase.getEarnings` para filtrar por mensajero específico.
4. WHERE el parámetro `courier_id` no es proporcionado, THE `BffSettlementsUseCase` SHALL invocar `ConsultarLiquidacionesUseCase.getEarnings` sin `courier_id` para retornar datos globales de la empresa.
5. WHEN un usuario con rol `AUX` intenta acceder a `GET /api/bff/settlements`, THEN THE `RolesGuard` SHALL rechazar la petición con HTTP 403.
6. THE `BffSettlementsQueryDto` SHALL validar `courier_id` como UUID v4 cuando esté presente, usando `@IsUUID()`.

---

### Requirement 7: Ejecución paralela de consultas internas

**User Story:** Como arquitecto del sistema, quiero que todas las consultas internas de cada use-case BFF se ejecuten en paralelo, para minimizar la latencia total de cada endpoint agregado.

#### Acceptance Criteria

1. THE `BffDashboardUseCase` SHALL usar `Promise.all` para ejecutar sus tres consultas internas de forma concurrente.
2. THE `BffActiveOrdersUseCase` SHALL usar `Promise.all` para ejecutar sus dos consultas internas de forma concurrente.
3. THE `BffReportsUseCase` SHALL usar `Promise.all` para ejecutar sus dos consultas internas de forma concurrente.
4. THE `BffSettlementsUseCase` SHALL usar `Promise.all` para ejecutar sus tres consultas internas de forma concurrente.
5. THE `BffWeb` SHALL no tener repositorio propio ni acceder a `PrismaService` directamente.

---

### Requirement 8: Aislamiento de endpoints originales

**User Story:** Como desarrollador del frontend, quiero que los endpoints originales de cada módulo sigan disponibles sin cambios, para que la migración al BFF sea incremental y no rompa integraciones existentes.

#### Acceptance Criteria

1. THE `BffWebModule` SHALL no modificar ni sobrescribir los controllers, use-cases ni repositorios de `ServiciosModule`, `MensajerosModule`, `ReportesModule` ni `LiquidacionesModule`.
2. WHILE el módulo `BffWeb` está activo, THE `ServiciosModule` SHALL continuar exponiendo sus endpoints originales en `/api/services` sin alteraciones.
3. WHILE el módulo `BffWeb` está activo, THE `MensajerosModule` SHALL continuar exponiendo sus endpoints originales en `/api/mensajeros` sin alteraciones.
4. WHILE el módulo `BffWeb` está activo, THE `ReportesModule` SHALL continuar exponiendo sus endpoints originales en `/api/reports` sin alteraciones.
5. WHILE el módulo `BffWeb` está activo, THE `LiquidacionesModule` SHALL continuar exponiendo sus endpoints originales en `/api/liquidations` sin alteraciones.

---

### Requirement 9: Cobertura de tests del módulo BffWeb

**User Story:** Como desarrollador backend, quiero que el módulo BffWeb tenga tests unitarios para cada use-case, para garantizar que la orquestación de consultas y las validaciones de negocio funcionan correctamente.

#### Acceptance Criteria

1. THE `BffDashboardUseCase` SHALL tener un test que verifique que `Promise.all` se invoca con las tres consultas internas y que el resultado contiene `pending_services`, `active_couriers` y `today_financial`.
2. THE `BffActiveOrdersUseCase` SHALL tener un test que verifique que el resultado contiene `services` y `available_couriers`.
3. THE `BffReportsUseCase` SHALL tener un test que verifique que lanza `AppException` con HTTP 400 cuando `from` o `to` están ausentes.
4. THE `BffReportsUseCase` SHALL tener un test que verifique que lanza `AppException` con HTTP 400 cuando `from >= to`.
5. THE `BffReportsUseCase` SHALL tener un test que verifique que el resultado contiene `services` y `financial` cuando `from` y `to` son válidos y `from < to`.
6. THE `BffSettlementsUseCase` SHALL tener un test que verifique que el resultado contiene `couriers`, `active_rule` y `earnings`.
7. THE `BffSettlementsUseCase` SHALL tener un test que verifique que `courier_id` se pasa correctamente a `ConsultarLiquidacionesUseCase.getEarnings` cuando está presente.
8. THE `BffSettlementsUseCase` SHALL tener un test que verifique que `getEarnings` se invoca sin `courier_id` cuando el parámetro no se proporciona.
