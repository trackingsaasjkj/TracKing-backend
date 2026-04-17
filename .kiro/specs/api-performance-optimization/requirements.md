# Requirements Document

## Introduction

TracKing actualmente experimenta tiempos de respuesta lentos en todas las peticiones API: carga de tablas de servicios, cards del dashboard, navegación entre páginas y operaciones del módulo mobile. El objetivo de esta optimización es reducir los tiempos de respuesta percibidos en el frontend web y la app mobile mediante tres estrategias complementarias: (1) caché en memoria en el backend para datos frecuentes y semi-estáticos, (2) paginación server-side en los endpoints de listado, y (3) configuración de stale time y caché en React Query en el frontend. No se requieren cambios de infraestructura ni migraciones de base de datos.

## Glossary

- **Cache_Service**: Servicio NestJS singleton que almacena resultados de consultas en memoria con TTL configurable.
- **BFF**: Backend for Frontend — módulo `bff-web` que agrega datos de múltiples módulos en una sola respuesta.
- **TTL**: Time To Live — tiempo en segundos durante el cual una entrada de caché es válida antes de expirar.
- **Stale Time**: Tiempo en milisegundos durante el cual React Query considera los datos frescos y no lanza una nueva petición al servidor.
- **Query_Client**: Instancia de `QueryClient` de React Query que gestiona el caché del frontend.
- **Pagination_DTO**: DTO con campos `page` (número de página, base 1) y `limit` (registros por página, máximo 100).
- **Paginated_Response**: Objeto de respuesta con campos `data` (array de registros), `total` (total de registros), `page` y `limit`.
- **Repository**: Clase de infraestructura que encapsula las consultas a Prisma/PostgreSQL.
- **Use_Case**: Clase de aplicación que orquesta la lógica de negocio usando repositorios.

---

## Requirements

### Requirement 1: Caché en memoria para el BFF Web

**User Story:** Como usuario del panel web, quiero que el dashboard y las páginas de órdenes activas carguen rápidamente, para no esperar cada vez que navego entre secciones.

#### Acceptance Criteria

1. THE Cache_Service SHALL almacenar entradas con una clave string y un valor arbitrario, asociados a un TTL en segundos.
2. WHEN el TTL de una entrada expira, THE Cache_Service SHALL eliminar la entrada y retornar `null` en la siguiente consulta.
3. WHEN el BFF ejecuta `bff-dashboard`, THE BFF SHALL consultar el Cache_Service antes de ejecutar las consultas a la base de datos.
4. WHEN el Cache_Service retorna un valor válido para la clave de dashboard, THE BFF SHALL retornar ese valor sin ejecutar consultas adicionales a la base de datos.
5. WHEN el Cache_Service retorna `null` para la clave de dashboard, THE BFF SHALL ejecutar las consultas en paralelo, almacenar el resultado en el Cache_Service con TTL de 30 segundos, y retornar el resultado.
6. WHEN el BFF ejecuta `bff-active-orders`, THE BFF SHALL aplicar la misma estrategia de caché con TTL de 20 segundos.
7. WHEN se crea, actualiza o cancela un servicio, THE Cache_Service SHALL invalidar las entradas de caché relacionadas con servicios activos y dashboard.
8. IF el Cache_Service supera 500 entradas almacenadas simultáneamente, THEN THE Cache_Service SHALL eliminar las entradas más antiguas para mantener el límite.

---

### Requirement 2: Paginación server-side en endpoints de listado

**User Story:** Como usuario del panel web, quiero que las tablas de servicios, clientes y mensajeros carguen solo los registros de la página actual, para que la respuesta sea rápida incluso con miles de registros.

#### Acceptance Criteria

1. THE Pagination_DTO SHALL aceptar los parámetros `page` (entero ≥ 1, default 1) y `limit` (entero entre 1 y 100, default 20).
2. WHEN el endpoint `GET /api/servicios` recibe parámetros de paginación válidos, THE Repository SHALL ejecutar la consulta con `take` igual a `limit` y `skip` igual a `(page - 1) * limit`.
3. WHEN el endpoint `GET /api/servicios` recibe parámetros de paginación válidos, THE Use_Case SHALL retornar un Paginated_Response con `data`, `total`, `page` y `limit`.
4. WHEN el endpoint `GET /api/clientes` recibe parámetros de paginación válidos, THE Repository SHALL ejecutar la consulta con `take` y `skip` calculados desde `page` y `limit`.
5. WHEN el endpoint `GET /api/mensajeros` recibe parámetros de paginación válidos, THE Repository SHALL ejecutar la consulta con `take` y `skip` calculados desde `page` y `limit`.
6. IF `page` o `limit` contienen valores fuera del rango permitido, THEN THE API SHALL retornar un error HTTP 400 con un mensaje descriptivo.
7. WHEN se solicita una página que excede el total de registros, THE API SHALL retornar `data: []` con `total` correcto y HTTP 200.
8. THE Repository SHALL ejecutar `findMany` y `count` en paralelo usando `Promise.all` para minimizar la latencia total de la consulta paginada.

---

### Requirement 3: Caché en React Query (frontend web)

**User Story:** Como usuario del panel web, quiero que al navegar entre páginas los datos ya visitados se muestren instantáneamente, para tener una experiencia fluida sin spinners repetitivos.

#### Acceptance Criteria

1. THE Query_Client SHALL configurar un `staleTime` global de 30 segundos para todas las queries.
2. THE Query_Client SHALL configurar un `gcTime` (garbage collection time) global de 5 minutos para todas las queries.
3. WHEN el usuario navega a una página cuya query fue ejecutada hace menos de 30 segundos, THE Query_Client SHALL retornar los datos del caché sin lanzar una nueva petición al servidor.
4. WHEN el usuario navega a una página cuya query fue ejecutada hace más de 30 segundos, THE Query_Client SHALL retornar los datos del caché inmediatamente y lanzar una petición en background para refrescar los datos.
5. WHEN una mutación de creación, edición o eliminación tiene éxito, THE Query_Client SHALL invalidar las queries relacionadas para forzar un refresco en la próxima visita.
6. WHERE la página de servicios utiliza paginación server-side, THE Query_Client SHALL incluir `page` y `limit` como parte de la `queryKey` para cachear cada página de forma independiente.

---

### Requirement 4: Optimización de consultas Prisma con select explícito

**User Story:** Como desarrollador, quiero que las consultas a la base de datos retornen solo los campos necesarios, para reducir el volumen de datos transferidos entre Supabase y el backend.

#### Acceptance Criteria

1. WHEN el Repository ejecuta `findAllByCompany` para servicios en el contexto del listado de tabla, THE Repository SHALL usar `select` explícito que excluya campos no utilizados en la vista de tabla (como `notes_observations` y `statusHistory`).
2. WHEN el Repository ejecuta `findAll` para mensajeros, THE Repository SHALL usar `select` explícito en el `include` de `user` que retorne solo `id`, `name`, `email` y `status`.
3. WHEN el Repository ejecuta `findAll` para clientes, THE Repository SHALL usar `select` explícito que retorne solo los campos requeridos por la vista de tabla: `id`, `name`, `phone`, `email`, `address`, `status`, `is_favorite`, `created_at`.
4. WHEN el Repository ejecuta `findAll` para usuarios, THE Repository SHALL usar `select` explícito que excluya `password_hash` y `failed_attempts`.
5. IF una consulta de listado incluye relaciones anidadas no requeridas por la vista, THEN THE Repository SHALL omitir esas relaciones del `include`.

---

### Requirement 5: Caché en el cliente mobile (React Native)

**User Story:** Como mensajero usando la app mobile, quiero que la lista de mis servicios cargue rápido y no parpadee al navegar, para poder operar sin interrupciones.

#### Acceptance Criteria

1. THE apiClient mobile SHALL configurar un timeout de 10 segundos por petición (ya existente, debe mantenerse).
2. WHEN la app mobile utiliza React Query, THE Query_Client mobile SHALL configurar un `staleTime` de 60 segundos para las queries de listado de servicios del mensajero.
3. WHEN la app mobile utiliza React Query, THE Query_Client mobile SHALL configurar un `gcTime` de 10 minutos para mantener datos en caché durante la sesión.
4. WHEN el mensajero actualiza el estado de un servicio, THE Query_Client mobile SHALL invalidar la query de listado de servicios para reflejar el cambio.
5. WHERE la app mobile muestra la lista de servicios del mensajero, THE Query_Client mobile SHALL usar `keepPreviousData: true` (o `placeholderData: keepPreviousData`) para evitar parpadeos al cambiar de página o filtro.
