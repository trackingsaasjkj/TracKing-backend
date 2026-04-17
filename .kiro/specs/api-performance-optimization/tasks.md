# Implementation Plan: api-performance-optimization

## Overview

Optimización de rendimiento en tres frentes: caché en memoria en el backend (BFF), paginación server-side en los endpoints de listado, y configuración de React Query en el frontend web y la app mobile. No requiere migraciones de base de datos.

## Tasks

- [x] 1. Crear CacheService en el backend
  - Crear `TracKing-backend/src/infrastructure/cache/cache.service.ts` con `Map` interno, TTL por entrada y evicción LRU cuando supera 500 entradas
  - Implementar métodos: `get<T>(key): T | null`, `set(key, value, ttlSeconds)`, `delete(key)`, `deleteByPrefix(prefix)`, `size(): number`
  - `get` debe verificar expiración y retornar `null` si la entrada expiró (y eliminarla del Map)
  - `set` debe llamar `evictOldestIfNeeded()` antes de insertar si el Map tiene ≥ 500 entradas
  - Crear `TracKing-backend/src/infrastructure/cache/cache.module.ts` como módulo `@Global()` que exporta `CacheService`
  - Importar `CacheModule` en `AppModule`
  - _Requirements: 1.1, 1.2, 1.8_

- [x] 2. Write property tests para CacheService
  - Crear `TracKing-backend/specs/api-performance-optimization.spec.ts`
  - **Property 1: Round-trip de caché** — para cualquier (key, value, ttl > 0), `set` seguido de `get` retorna el mismo valor
  - **Property 3: Invalidación por prefijo** — para cualquier `company_id`, después de `deleteByPrefix`, las claves relacionadas retornan `null`
  - **Property 4: Límite de 500 entradas** — para cualquier N > 500 inserciones, `cache.size() <= 500`
  - Agregar unit test para TTL expirado (fake timers: `jest.useFakeTimers`, avanzar tiempo, verificar `null`)
  - Cada property test con `numRuns: 100` y comentario `// Feature: api-performance-optimization, Property N: <texto>`
  - _Requirements: 1.1, 1.2, 1.8_

- [x] 3. Integrar CacheService en BffDashboardUseCase
  - Inyectar `CacheService` en `BffDashboardUseCase`
  - Al inicio de `execute(company_id)`: consultar `cache.get(`bff:dashboard:${company_id}`)` y retornar si no es `null`
  - En cache miss: ejecutar las consultas en paralelo (ya usa `Promise.all`), llamar `cache.set(key, result, 30)` y retornar el resultado
  - _Requirements: 1.3, 1.4, 1.5_

- [x] 4. Integrar CacheService en BffActiveOrdersUseCase
  - Inyectar `CacheService` en `BffActiveOrdersUseCase`
  - Misma estrategia que el dashboard con clave `bff:active-orders:${company_id}` y TTL de 20 segundos
  - _Requirements: 1.6_

- [x] 5. Write property tests para BFF con caché
  - En `specs/api-performance-optimization.spec.ts`, agregar:
  - **Property 2: Cache hit evita DB** — para cualquier objeto de respuesta cacheado, `BffDashboardUseCase.execute` retorna el objeto sin invocar los use-cases de DB
  - Unit test: cache miss en dashboard → `cache.set` llamado con TTL=30
  - Unit test: cache miss en active-orders → `cache.set` llamado con TTL=20
  - _Requirements: 1.3, 1.4, 1.5, 1.6_

- [x] 6. Invalidación de caché en mutaciones de servicios
  - En `CrearServicioUseCase.execute`: después de crear el servicio, llamar `cache.deleteByPrefix(`bff:dashboard:${company_id}`)` y `cache.deleteByPrefix(`bff:active-orders:${company_id}`)`
  - En `CancelarServicioUseCase.execute`: misma invalidación
  - En `CambiarEstadoUseCase.execute`: misma invalidación
  - Inyectar `CacheService` en los tres use-cases
  - _Requirements: 1.7_

- [x] 7. Write property test para invalidación de caché
  - **Property 3: Invalidación de caché por company_id** — para cualquier `company_id`, después de invocar la invalidación, las claves `bff:dashboard:{company_id}` y `bff:active-orders:{company_id}` retornan `null`
  - _Requirements: 1.7_

- [x] 8. Crear PaginationDto y PaginatedResponse
  - Crear `TracKing-backend/src/core/dto/pagination.dto.ts` con `page` (default 1, min 1) y `limit` (default 20, min 1, max 100) usando `class-validator` y `@Type(() => Number)`
  - Crear `TracKing-backend/src/core/types/paginated-response.type.ts` con interfaz `PaginatedResponse<T>` con campos `data`, `total`, `page`, `limit`
  - _Requirements: 2.1_

- [x] 9. Write property tests para PaginationDto
  - **Property 7: Validación de parámetros fuera de rango** — para cualquier `page < 1` o `limit` fuera de `[1, 100]`, `validate(dto)` retorna errores
  - Agregar unit test: valores por defecto (`page=1`, `limit=20`) cuando no se pasan parámetros
  - _Requirements: 2.1, 2.6_

- [x] 10. Paginación en ServicioRepository
  - Agregar método `findAllByCompanyPaginated` en `ServicioRepository` que:
    - Acepta `pagination: { page: number; limit: number }`
    - Ejecuta `prisma.service.findMany` y `prisma.service.count` en paralelo con `Promise.all`
    - Usa `take = limit` y `skip = (page - 1) * limit`
    - Usa `select` explícito que excluye `notes_observations` y `statusHistory`
    - Incluye `customer: { select: { id, name, phone } }` y `courier: { select: { id, user: { select: { id, name } } } }`
    - Retorna `PaginatedResponse<ServiceTableRow>`
  - _Requirements: 2.2, 2.3, 2.8, 4.1_

- [x] 11. Write property tests para paginación de servicios
  - **Property 5: Cálculo correcto de skip/take** — para cualquier `(page ≥ 1, 1 ≤ limit ≤ 100)`, el repositorio es invocado con `take=limit` y `skip=(page-1)*limit`
  - **Property 6: Forma del PaginatedResponse** — para cualquier `(page, limit)` válido, el use-case retorna objeto con `data` (array), `total` (número), `page` y `limit` correctos
  - Unit test: página fuera de rango retorna `data: []` con `total` correcto y HTTP 200
  - Unit test: `findMany` y `count` se ejecutan en paralelo (ambos mocks llamados)
  - _Requirements: 2.2, 2.3, 2.7, 2.8_

- [x] 12. Actualizar ConsultarServiciosUseCase y ServiciosController para paginación
  - Agregar método `findAllPaginated` en `ConsultarServiciosUseCase` que delega a `findAllByCompanyPaginated`
  - En `ServiciosController.findAll`: agregar `@Query() pagination: PaginationDto` y llamar `findAllPaginated` cuando se reciban parámetros de paginación
  - Agregar `@ApiQuery` para `page` y `limit` en el endpoint `GET /api/services`
  - _Requirements: 2.2, 2.3_

- [x] 13. Paginación en CustomersRepository
  - Agregar método `findAllPaginated` en `CustomersRepository` que:
    - Ejecuta `findMany` y `count` en paralelo con `Promise.all`
    - Usa `select` explícito: `id`, `name`, `phone`, `email`, `address`, `status`, `is_favorite`, `created_at`
    - Retorna `PaginatedResponse<CustomerTableRow>`
  - Actualizar `CustomersUseCases.findAll` para aceptar paginación opcional
  - Actualizar `CustomersController.findAll` para aceptar `PaginationDto` como query params
  - _Requirements: 2.4, 4.3_

- [x] 14. Paginación en MensajeroRepository
  - Agregar método `findAllPaginated` en `MensajeroRepository` que:
    - Ejecuta `findMany` y `count` en paralelo con `Promise.all`
    - Mantiene el `select` explícito existente en `user`: `id`, `name`, `email`, `status`
    - Retorna `PaginatedResponse<MensajeroTableRow>`
  - Actualizar `ConsultarMensajerosUseCase.findAll` para aceptar paginación opcional
  - Actualizar `MensajerosController.findAll` para aceptar `PaginationDto` como query params
  - _Requirements: 2.5, 4.2_

- [x] 15. Checkpoint backend — Verificar que todos los tests pasan
  - Ejecutar `npm run test:run` en `TracKing-backend` y confirmar que todos los tests pasan
  - Verificar que los endpoints existentes siguen funcionando (sin paginación = comportamiento anterior)

- [x] 16. Configurar React Query en el frontend web
  - En `TracKing-frontend/src/lib/queryClient.ts`: agregar `staleTime: 30_000` y `gcTime: 300_000` a `defaultOptions.queries`
  - _Requirements: 3.1, 3.2_

- [x] 17. Write smoke tests para configuración de QueryClient web
  - Crear test que verifica `queryClient.getDefaultOptions().queries.staleTime === 30_000`
  - Crear test que verifica `queryClient.getDefaultOptions().queries.gcTime === 300_000`
  - _Requirements: 3.1, 3.2_

- [x] 18. Actualizar ServiciosPage para paginación server-side y queryKey con page+limit
  - Identificar la página principal de listado de servicios (activos/pendientes) en el frontend
  - Agregar estado `page` y `limit` con `useState`
  - Actualizar `useQuery` para incluir `page` y `limit` en la `queryKey`: `['services', { page, limit, ...filters }]`
  - Actualizar la llamada a `servicesService.getAll` para pasar `page` y `limit`
  - Actualizar `servicesService.getAll` para aceptar y enviar `page` y `limit` como query params
  - Reemplazar la paginación client-side actual por la respuesta `PaginatedResponse` del servidor
  - _Requirements: 3.6_

- [x] 19. Write property test para queryKey con paginación
  - **Property 9: Query key incluye page y limit** — para cualquier `(page, limit)`, la `queryKey` del `useQuery` de servicios contiene ambos valores
  - _Requirements: 3.6_

- [x] 20. Agregar invalidación de queries en mutaciones del frontend web
  - En cada mutación exitosa de servicios (`crear`, `cancelar`, `cambiarEstado`, `asignar`): llamar `queryClient.invalidateQueries({ queryKey: ['services'] })`
  - En mutaciones de clientes: invalidar `['customers']`
  - En mutaciones de mensajeros: invalidar `['mensajeros']`
  - Verificar que las páginas BFF (`bff/dashboard`, `bff/active-orders`) también se invalidan cuando corresponde
  - _Requirements: 3.5_

- [x] 21. Write property test para invalidación de queries en mutaciones web
  - **Property 8: Invalidación de queries en mutaciones** — para cualquier mutación exitosa de servicios, `queryClient.invalidateQueries` es invocado con la query key correcta
  - _Requirements: 3.5_

- [x] 22. Configurar React Query en la app mobile
  - En `TracKing-Mobile-/src/app/providers/AppProviders.tsx`: actualizar `staleTime` a `60_000` y agregar `gcTime: 600_000`
  - _Requirements: 5.2, 5.3_

- [x] 23. Write smoke tests para configuración de QueryClient mobile
  - Crear test que verifica `staleTime === 60_000` y `gcTime === 600_000` en el QueryClient mobile
  - Verificar que `apiClient.defaults.timeout === 10_000` (existente, no debe cambiar)
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 24. Migrar useServices hook a React Query en mobile
  - En `TracKing-Mobile-/src/features/services/hooks/useServices.ts`: reemplazar el patrón `useState/useEffect` manual por `useQuery` de `@tanstack/react-query`
  - Usar `queryKey: ['courier-services']`
  - Usar `placeholderData: keepPreviousData` para evitar parpadeos
  - Mantener la función `performAction` (mutación de estado) sin cambios en su lógica
  - Después de `performAction` exitoso: llamar `queryClient.invalidateQueries({ queryKey: ['courier-services'] })`
  - _Requirements: 5.4, 5.5_

- [x] 25. Write property test para invalidación de queries en mobile
  - **Property 10: Invalidación en mobile** — para cualquier actualización de estado de servicio exitosa, la query `['courier-services']` es invalidada
  - _Requirements: 5.4_

- [x] 26. Checkpoint final — Verificar que todos los tests pasan
  - Ejecutar `npm run test:run` en `TracKing-backend` y confirmar que todos los tests pasan
  - Verificar manualmente que el frontend web y la app mobile compilan sin errores de TypeScript
