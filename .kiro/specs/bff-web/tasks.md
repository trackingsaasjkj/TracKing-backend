# Implementation Plan: bff-web

## Overview

Migración BFF-Web en dos frentes: fix puntual en el backend (DTO de reports) y migración del frontend para que las cuatro páginas principales consuman los endpoints BFF en lugar de múltiples llamadas independientes. Los tests de propiedad se escriben con `fast-check` en el backend.

## Tasks

- [x] 1. Fix backend: corregir `BffReportsQueryDto`
  - En `TracKing-backend/src/modules/bff-web/application/dto/bff-query.dto.ts`, cambiar `@IsOptional()` por `@IsNotEmpty()` en `from` y `to`
  - Cambiar `@ApiPropertyOptional` por `@ApiProperty` en ambos campos
  - Eliminar el `?` de los tipos para que sean `from: string` y `to: string`
  - _Requirements: 5.3, 5.6_

- [x] 2. Crear tipos BFF en el frontend
  - [x] 2.1 Crear `TracKing-frontend/src/types/bff.ts` con todas las interfaces del diseño
    - `BffPeriod`, `BffRevenue`, `BffPaymentMethodStat`, `BffSettlementSummary`
    - `BffTodayFinancial`, `BffDashboardResponse`
    - `BffActiveOrdersResponse`
    - `BffServicesReport`, `BffFinancialReport`, `BffReportsResponse`
    - `BffActiveRule`, `BffEarnings`, `BffSettlementsResponse`
    - Importar `Service`, `Mensajero`, `Liquidation` desde `@/types`
    - _Requirements: 3.2, 4.2, 5.2, 6.2_

  - [x] 2.2 Write property test for BffDashboardResponse shape
    - **Property 1: Forma del resultado del dashboard**
    - **Validates: Requirements 3.1, 3.2**

- [x] 3. Crear `bffService.ts` en el frontend
  - [x] 3.1 Crear `TracKing-frontend/src/services/bffService.ts` con los 4 métodos
    - `getDashboard(): Promise<BffDashboardResponse>` → `GET /bff/dashboard`
    - `getActiveOrders(): Promise<BffActiveOrdersResponse>` → `GET /bff/active-orders`
    - `getReports(params: { from: string; to: string }): Promise<BffReportsResponse>` → `GET /bff/reports`
    - `getSettlements(params?: { courier_id?: string }): Promise<BffSettlementsResponse>` → `GET /bff/settlements`
    - Seguir el mismo patrón de `res.data ?? res` que usan los servicios existentes
    - _Requirements: 3.1, 4.1, 5.1, 6.1_

  - [x] 3.2 Write property test for bffService method signatures
    - **Property 2: Forma del resultado de active-orders**
    - **Validates: Requirements 4.1, 4.2**

- [x] 4. Migrar `DashboardPage`
  - [x] 4.1 Reemplazar las tres queries independientes por una sola query a `bffService.getDashboard()`
    - Eliminar imports de `servicesService`, `mensajerosService`, `reportsService`
    - Agregar import de `bffService` y tipos `BffDashboardResponse`
    - Reemplazar `allServices`, `activeCouriers` y `financial` por los campos de `BffDashboardResponse`
    - Actualizar `metrics.revenue` para leer `today_financial.revenue.total_price` en lugar de `financial?.total_revenue`
    - Actualizar `metrics.active` para leer `pending_services.length`
    - Actualizar `metrics.couriersAvailable` para leer `active_couriers.filter(m => m.status === 'AVAILABLE').length`
    - La tabla de servicios activos usa `pending_services` (ya filtrados por el BFF)
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 4.2 Write property test for DashboardPage BFF data rendering
    - **Property 1 (frontend): DashboardPage renderiza métricas desde BFF**
    - **Validates: Requirements 3.2**

- [x] 5. Migrar `ActiveOrdersPage`
  - [x] 5.1 Reemplazar las dos queries independientes por una sola query a `bffService.getActiveOrders()`
    - Eliminar imports de `servicesService` y `mensajerosService` (solo para las queries de carga)
    - Agregar import de `bffService` y tipos `BffActiveOrdersResponse`
    - Reemplazar query de `services` y `couriers` por una sola query BFF
    - Leer `data.services` y `data.available_couriers` del resultado
    - Las mutaciones `assignMutation` y `cancelMutation` siguen usando `servicesService` sin cambios
    - _Requirements: 4.1, 4.2_

  - [x] 5.2 Write property test for ActiveOrdersPage BFF data rendering
    - **Property 2 (frontend): ActiveOrdersPage renderiza servicios y mensajeros desde BFF**
    - **Validates: Requirements 4.2**

- [x] 6. Checkpoint — Asegurar que DashboardPage y ActiveOrdersPage funcionan
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Migrar `ReportsPage`
  - [x] 7.1 Reemplazar las queries de `reports/services` y `reports/financial` por una sola query a `bffService.getReports()`
    - Agregar import de `bffService` y tipos `BffReportsResponse`
    - Mantener la query de `reportsService.getCouriersReport` sin cambios (no tiene equivalente BFF)
    - Actualizar la query BFF para que use `enabled: !!filters`
    - Actualizar el renderizado de `servicesReport` para leer `bffData.services.by_status` (array `BffServicesByStatus[]`) en lugar de `Record<ServiceStatus, number>`
    - Actualizar el renderizado de `financialReport` para leer `bffData.financial.revenue.total_price` en lugar de `total_revenue`
    - _Requirements: 5.1, 5.2_

  - [x] 7.2 Write property test for ReportsPage BFF data rendering
    - **Property 3 (frontend): ReportsPage renderiza datos de services y financial desde BFF**
    - **Validates: Requirements 5.2**

- [x] 8. Migrar `SettlementsPage`
  - [x] 8.1 Reemplazar las tres queries de carga inicial por una sola query a `bffService.getSettlements()`
    - Agregar import de `bffService` y tipos `BffSettlementsResponse`
    - Eliminar queries de `mensajerosService.getActivos`, `liquidationsService.getActiveRule` y `liquidationsService.getEarnings`
    - Leer `data.couriers`, `data.active_rule` y `data.earnings` del resultado BFF
    - Actualizar `MetricCard` de ganancias para leer `earnings.total_earned`
    - Actualizar `MetricCard` de servicios para leer `earnings.total_services` (en lugar de `earnings.services_count`)
    - Actualizar la condición de regla activa para leer `active_rule.active` (en lugar de `is_active`)
    - Mantener la query de `liquidationsService.getAll(courierId)` sin cambios (historial completo no está en BFF)
    - La mutación `generateMutation` sigue usando `liquidationsService.generateForCourier` sin cambios
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 8.2 Write property test for SettlementsPage BFF data rendering
    - **Property 4 (frontend): SettlementsPage renderiza couriers, active_rule y earnings desde BFF**
    - **Validates: Requirements 6.2**

- [x] 9. Crear tests de propiedad backend con fast-check
  - [x] 9.1 Instalar `fast-check` como devDependency en `TracKing-backend`
    - Ejecutar `npm install --save-dev fast-check` en `TracKing-backend`
    - _Requirements: 9.1_

  - [x] 9.2 Crear `TracKing-backend/specs/bff-web.spec.ts` con tests de propiedades 1–4 (formas de resultado)
    - Mockear los use-cases internos para retornar datos válidos
    - **Property 1:** `BffDashboardUseCase` retorna `pending_services`, `active_couriers`, `today_financial` para cualquier `company_id` (uuid arbitrario)
    - **Property 2:** `BffActiveOrdersUseCase` retorna `services` y `available_couriers` para cualquier `company_id`
    - **Property 3:** `BffReportsUseCase` retorna `services` y `financial` para cualquier par `(from, to)` válido con `from < to`
    - **Property 4:** `BffSettlementsUseCase` retorna `couriers`, `active_rule` y `earnings` para cualquier `company_id`
    - Cada propiedad con `numRuns: 100` y comentario `// Feature: bff-web, Property N: <texto>`
    - _Requirements: 9.1, 9.2, 9.5, 9.6_

  - [x] 9.3 Agregar tests de propiedades 5–6 (validación de parámetros en reports)
    - **Property 5:** `BffReportsUseCase` lanza `AppException` 400 cuando `from` o `to` están ausentes (undefined, null, string vacío)
    - **Property 6:** `BffReportsUseCase` lanza `AppException` 400 cuando `from >= to`
    - _Requirements: 9.3, 9.4_

  - [x] 9.4 Agregar tests de propiedades 7–8 (paso de courier_id y propagación de excepciones)
    - **Property 7:** `BffSettlementsUseCase` pasa `courier_id` a `getEarnings` exactamente como se recibe (presente o ausente)
    - **Property 8:** Cualquier use-case BFF propaga excepciones internas sin suprimirlas
    - _Requirements: 9.7, 9.8_

- [x] 10. Checkpoint final — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Las mutaciones (`assign`, `cancel`, `generateForCourier`) no se tocan — solo migran las queries de carga inicial
- `reportsService.getCouriersReport` permanece en `ReportsPage` (no tiene endpoint BFF equivalente)
- `liquidationsService.getAll` permanece en `SettlementsPage` (historial completo no está en BFF)
- Los servicios originales no se eliminan — siguen siendo usados por otras páginas
