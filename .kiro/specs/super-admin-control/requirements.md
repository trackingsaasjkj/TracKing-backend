# Requirements Document

## Introduction

Esta feature introduce el rol de **Super Administrador** en la plataforma multi-tenant de courier/mensajería. El Super Admin opera por encima del aislamiento de tenant: puede gestionar empresas (tenants), usuarios de cualquier tenant, configuraciones globales del sistema, y tiene acceso a monitoreo y métricas transversales. A diferencia del rol `ADMIN` (que está acotado a su propio `company_id`), el Super Admin no pertenece a ningún tenant específico y su contexto de autenticación omite el `company_id` como restricción de acceso.

El objetivo es centralizar el control operativo y administrativo de toda la plataforma en un único punto de acceso seguro, auditado y con capacidades que ningún otro rol posee.

---

## Glossary

- **Super_Admin**: Usuario con rol `SUPER_ADMIN` que tiene acceso irrestricto a todos los recursos de la plataforma, independientemente del tenant.
- **Tenant**: Empresa registrada en la plataforma, representada por el modelo `Company` en la base de datos.
- **Admin**: Usuario con rol `ADMIN` acotado a un único tenant (`company_id`).
- **Sistema**: La plataforma backend NestJS multi-tenant en su conjunto.
- **Super_Admin_Module**: Módulo NestJS dedicado que agrupa todos los endpoints y casos de uso del Super Admin.
- **Audit_Log**: Registro inmutable de acciones realizadas por el Super Admin sobre recursos del sistema.
- **Global_Config**: Configuración de parámetros del sistema que aplican a todos los tenants (ej. límites de rate, flags de features).
- **SuperAdmin_Guard**: Guard NestJS que verifica que el usuario autenticado posea el rol `SUPER_ADMIN`.
- **JWT_Payload**: Estructura del token JWT que incluye `sub`, `email`, `role`, y opcionalmente `company_id`.

---

## Requirements

### Requirement 1: Rol y Autenticación del Super Admin

**User Story:** Como operador de la plataforma, quiero autenticarme como Super Admin, para que pueda acceder a las capacidades de control centralizado sin estar restringido a un tenant.

#### Acceptance Criteria

1. THE Sistema SHALL soportar el valor `SUPER_ADMIN` en el enum `UserRole` de la base de datos.
2. WHEN un usuario con rol `SUPER_ADMIN` se autentica, THE Sistema SHALL emitir un JWT cuyo payload incluya `role: "SUPER_ADMIN"` y `company_id: null`.
3. THE SuperAdmin_Guard SHALL denegar el acceso con HTTP 403 a cualquier endpoint del Super_Admin_Module cuando el JWT no contenga `role: "SUPER_ADMIN"`.
4. IF el token JWT de una solicitud al Super_Admin_Module está ausente o es inválido, THEN THE Sistema SHALL responder con HTTP 401.
5. THE Sistema SHALL permitir que exista al menos un usuario `SUPER_ADMIN` sin `company_id` asociado en la base de datos.
6. WHEN el Super_Admin_Module recibe una solicitud autenticada como `SUPER_ADMIN`, THE SuperAdmin_Guard SHALL permitir el acceso sin verificar `company_id`.

---

### Requirement 2: Gestión de Tenants (Empresas)

**User Story:** Como Super Admin, quiero gestionar el ciclo de vida completo de los tenants, para que pueda crear, activar, suspender y eliminar empresas desde un punto centralizado.

#### Acceptance Criteria

1. THE Super_Admin_Module SHALL exponer un endpoint para listar todos los tenants con paginación, incluyendo tenants activos e inactivos.
2. WHEN el Super Admin envía una solicitud de creación de tenant con nombre válido, THE Super_Admin_Module SHALL crear el tenant y responder con los datos del tenant creado incluyendo su `id`.
3. IF el nombre del tenant enviado en la solicitud de creación ya existe en la base de datos, THEN THE Super_Admin_Module SHALL responder con HTTP 409 y un mensaje descriptivo.
4. WHEN el Super Admin solicita suspender un tenant, THE Super_Admin_Module SHALL establecer `status = false` en el tenant y responder con HTTP 200.
5. WHEN un tenant está suspendido (`status = false`), THE Sistema SHALL rechazar con HTTP 403 los intentos de login de usuarios pertenecientes a ese tenant.
6. WHEN el Super Admin solicita reactivar un tenant suspendido, THE Super_Admin_Module SHALL establecer `status = true` en el tenant.
7. WHEN el Super Admin solicita eliminar un tenant, THE Super_Admin_Module SHALL eliminar el tenant y todos sus datos asociados en cascada, y registrar la acción en el Audit_Log.
8. THE Super_Admin_Module SHALL exponer un endpoint para obtener el detalle de un tenant por `id`, incluyendo conteo de usuarios, servicios activos y mensajeros.

---

### Requirement 3: Gestión de Usuarios Cross-Tenant

**User Story:** Como Super Admin, quiero gestionar usuarios de cualquier tenant, para que pueda intervenir en situaciones que el Admin del tenant no puede resolver.

#### Acceptance Criteria

1. THE Super_Admin_Module SHALL exponer un endpoint para listar usuarios de un tenant específico, con filtros por rol y estado.
2. WHEN el Super Admin solicita suspender un usuario, THE Super_Admin_Module SHALL establecer `status = SUSPENDED` en el usuario objetivo y responder con HTTP 200.
3. WHEN un usuario tiene `status = SUSPENDED`, THE Sistema SHALL rechazar con HTTP 403 los intentos de login de ese usuario.
4. WHEN el Super Admin solicita reactivar un usuario suspendido, THE Super_Admin_Module SHALL establecer `status = ACTIVE` en el usuario objetivo.
5. WHEN el Super Admin solicita cambiar el rol de un usuario, THE Super_Admin_Module SHALL actualizar el campo `role` del usuario con el nuevo valor válido.
6. IF el Super Admin intenta asignar el rol `SUPER_ADMIN` a un usuario que tiene `company_id` no nulo, THEN THE Super_Admin_Module SHALL responder con HTTP 422 indicando que los Super Admins no pueden pertenecer a un tenant.
7. WHEN el Super Admin solicita eliminar un usuario, THE Super_Admin_Module SHALL eliminar el usuario y registrar la acción en el Audit_Log.

---

### Requirement 4: Configuración Global del Sistema

**User Story:** Como Super Admin, quiero gestionar parámetros de configuración global, para que pueda ajustar el comportamiento de la plataforma sin necesidad de redespliegue.

#### Acceptance Criteria

1. THE Sistema SHALL persistir configuraciones globales clave-valor en una tabla `GlobalConfig` con campos `key`, `value`, `description` y `updated_at`.
2. THE Super_Admin_Module SHALL exponer un endpoint para listar todas las configuraciones globales.
3. WHEN el Super Admin actualiza el valor de una configuración global existente, THE Super_Admin_Module SHALL persistir el nuevo valor y actualizar `updated_at`.
4. IF el Super Admin intenta actualizar una clave de configuración que no existe, THEN THE Super_Admin_Module SHALL responder con HTTP 404.
5. THE Super_Admin_Module SHALL exponer un endpoint para crear nuevas entradas de configuración global con `key`, `value` y `description` obligatorios.
6. IF el Super Admin intenta crear una configuración con una `key` que ya existe, THEN THE Super_Admin_Module SHALL responder con HTTP 409.

---

### Requirement 5: Monitoreo y Métricas del Sistema

**User Story:** Como Super Admin, quiero visualizar métricas operativas de toda la plataforma, para que pueda tomar decisiones informadas sobre el estado del sistema.

#### Acceptance Criteria

1. THE Super_Admin_Module SHALL exponer un endpoint de resumen (`/super-admin/dashboard`) que retorne: total de tenants activos, total de usuarios por rol, total de servicios por estado, y total de mensajeros por estado operacional.
2. WHEN el Super Admin solicita métricas de un tenant específico, THE Super_Admin_Module SHALL retornar: servicios del período solicitado por estado, mensajeros activos, y monto total liquidado en el período.
3. THE Super_Admin_Module SHALL exponer un endpoint para listar los tenants ordenados por volumen de servicios en un rango de fechas dado.
4. WHEN el Super Admin solicita el dashboard, THE Super_Admin_Module SHALL retornar los datos calculados en tiempo real desde la base de datos.

---

### Requirement 6: Auditoría de Acciones del Super Admin

**User Story:** Como operador de la plataforma, quiero que todas las acciones del Super Admin queden registradas, para que exista trazabilidad completa de las intervenciones sobre el sistema.

#### Acceptance Criteria

1. THE Sistema SHALL persistir en una tabla `AuditLog` cada acción ejecutada por un Super Admin, con campos: `id`, `super_admin_id`, `action`, `entity_type`, `entity_id`, `payload`, `ip_address`, `created_at`.
2. WHEN el Super Admin ejecuta cualquier operación de escritura (crear, actualizar, eliminar) sobre cualquier recurso, THE Sistema SHALL crear un registro en `AuditLog` antes de retornar la respuesta.
3. THE Super_Admin_Module SHALL exponer un endpoint para consultar el Audit_Log con filtros por `super_admin_id`, `entity_type`, `action` y rango de fechas, con paginación.
4. IF la escritura en `AuditLog` falla, THEN THE Sistema SHALL registrar el error en los logs de aplicación y continuar con la operación principal sin interrumpirla.
5. THE Audit_Log SHALL ser de solo lectura a través de la API: ningún endpoint del Super_Admin_Module SHALL permitir modificar o eliminar registros de auditoría.

---

### Requirement 7: Aislamiento y Seguridad del Super Admin

**User Story:** Como arquitecto del sistema, quiero que el acceso de Super Admin esté completamente aislado y protegido, para que no sea posible escalar privilegios desde roles inferiores.

#### Acceptance Criteria

1. THE Super_Admin_Module SHALL aplicar el SuperAdmin_Guard a todos sus endpoints como guard a nivel de controlador.
2. IF un usuario con rol `ADMIN`, `AUX` o `COURIER` intenta acceder a cualquier endpoint del Super_Admin_Module, THEN THE Sistema SHALL responder con HTTP 403.
3. THE Sistema SHALL aplicar rate limiting específico de máximo 30 solicitudes por minuto al Super_Admin_Module, independiente del throttling global.
4. WHEN se crea un usuario `SUPER_ADMIN`, THE Sistema SHALL requerir que el campo `company_id` sea nulo en la base de datos.
5. THE Sistema SHALL exponer los endpoints del Super_Admin_Module bajo el prefijo `/api/super-admin/` para distinguirlos de los endpoints de tenant.
6. WHERE el entorno de ejecución es producción, THE Sistema SHALL requerir HTTPS para todas las solicitudes al Super_Admin_Module.

---

### Requirement 8: Protección del Endpoint de Documentación Swagger

**User Story:** As a platform operator, I want the Swagger documentation endpoint to be protected with HTTP Basic Auth, so that API internals are not publicly accessible and only the Super Admin can consult them.

#### Acceptance Criteria

1. THE Sistema SHALL protect the `/api/docs` endpoint with HTTP Basic Authentication, requiring valid credentials before serving any Swagger content.
2. WHEN a request to `/api/docs` includes valid HTTP Basic Auth credentials matching the values of the `SWAGGER_USER` and `SWAGGER_PASSWORD` environment variables, THE Sistema SHALL grant access and return the Swagger UI.
3. IF a request to `/api/docs` includes missing or incorrect HTTP Basic Auth credentials, THEN THE Sistema SHALL respond with HTTP 401 and a `WWW-Authenticate: Basic` header.
4. THE Sistema SHALL read the Swagger credentials exclusively from the `SWAGGER_USER` and `SWAGGER_PASSWORD` environment variables; credentials SHALL NOT be hardcoded in source code or configuration files.
5. WHERE the execution environment is production, THE Sistema SHALL support disabling the `/api/docs` endpoint entirely via a dedicated environment variable (e.g. `SWAGGER_ENABLED=false`), responding with HTTP 404 to any request targeting that path.
6. WHEN `SWAGGER_ENABLED` is not set or is set to a value other than `false`, THE Sistema SHALL treat the Swagger endpoint as enabled and enforce HTTP Basic Auth as described in criteria 1–4.
