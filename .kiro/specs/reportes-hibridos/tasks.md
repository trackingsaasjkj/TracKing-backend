# Plan de Implementación: Reportes Financieros Híbridos

## Visión General

Implementar el sistema de reportes financieros híbrido que combina datos de liquidaciones completadas (`CourierSettlement` SETTLED) con servicios pendientes de liquidar (`Service` DELIVERED + `is_settled_courier=false`), consolidándolos en memoria con caché de 300 s. Incluye nuevo repositorio, nuevo use case, nuevo endpoint REST, actualización del BFF y tres nuevos componentes React.

## Tareas

- [x] 1. Crear el DTO de query para el reporte híbrido
  - Crear `src/modules/reportes/application/dto/reporte-financiero-hibrido.dto.ts` con `ReporteFinancieroHibridoQueryDto` (campos `from` y `to` opcionales, decoradores `@IsOptional`, `@IsDateString`, `@ApiPropertyOptional`)
  - _Requisitos: 6.1, 6.2, 7.1_

- [x] 2. Implementar `ReportesHibridoRepository`
  - [x] 2.1 Crear el archivo `src/modules/reportes/infrastructure/reportes-hibrido.repository.ts` con la clase `ReportesHibridoRepository` decorada con `@Injectable()`
    - Inyectar `PrismaService` en el constructor
    - Definir las interfaces internas `SettledBranchResult`, `PendingBranchResult` y `PaymentMethodBreakdownRow`
    - _Requisitos: 1.1, 1.2, 1.3, 2.1, 2.2_

  - [x] 2.2 Implementar `getSettledBranch(company_id, from, to)`
    - Usar `prisma.courierSettlement.aggregate` filtrando por `company_id`, `status: 'SETTLED'` y `generation_date` en el rango
    - Retornar `{ count, total_services, total_collected, company_commission, courier_payment }` con ceros si no hay registros
    - _Requisitos: 1.1, 1.2, 1.3, 1.5_

  - [x] 2.3 Implementar `getPendingBranch(company_id, from, to)`
    - Usar `prisma.service.aggregate` filtrando por `company_id`, `status: 'DELIVERED'`, `is_settled_courier: false` y `delivery_date` en el rango
    - Retornar `{ count, total_collected }` con ceros si no hay registros
    - _Requisitos: 2.1, 2.2, 2.4_

  - [x] 2.4 Implementar `getSettledByPaymentMethod(company_id, from, to)`
    - Usar `prisma.$queryRaw` con JOIN entre `courier_settlement`, `settlement_service` y `service` agrupando por `payment_method`
    - Filtrar por `company_id`, `status = 'SETTLED'` y `generation_date` en el rango
    - _Requisitos: 1.4_

  - [x] 2.5 Implementar `getPendingByPaymentMethod(company_id, from, to)`
    - Usar `prisma.service.groupBy` con `by: ['payment_method']` filtrando por `company_id`, `status: 'DELIVERED'`, `is_settled_courier: false` y `delivery_date` en el rango
    - _Requisitos: 2.3_

  - [x] 2.6 Implementar `getActiveRule(company_id)`
    - Usar `prisma.settlementRule.findFirst` filtrando por `company_id` y `active: true`
    - Retornar `{ type, value }` o `null` si no existe regla activa
    - _Requisitos: 3.1, 3.4_

  - [ ]* 2.7 Escribir tests de propiedad para la agregación de liquidaciones
    - **Propiedad 1: Agregación de liquidaciones es consistente con los datos de entrada**
    - **Valida: Requisitos 1.2, 1.3**
    - Extraer la lógica de agregación a una función pura `aggregateSettled` y testearla con `fast-check`
    - Verificar que `count`, `total_services`, `total_collected`, `company_commission` y `courier_payment` coincidan con la suma manual

  - [ ]* 2.8 Escribir tests de propiedad para la agregación de pendientes
    - **Propiedad 2: Agregación de pendientes es consistente con los datos de entrada**
    - **Valida: Requisitos 2.2, 2.4**
    - Extraer la lógica de agregación a una función pura `aggregatePending` y testearla con `fast-check`
    - Verificar que `count` y `total_collected` coincidan con el conteo y suma manual de `delivery_price`

  - [ ]* 2.9 Escribir tests de propiedad para el groupBy por método de pago
    - **Propiedad 3: GroupBy por método de pago es partición completa**
    - **Valida: Requisito 2.3**
    - Extraer la lógica de agrupación a una función pura y testearla con `fast-check`
    - Verificar que la suma de todos los `total` de los grupos sea igual a la suma de `delivery_price` de todos los servicios

- [x] 3. Implementar las funciones puras de cálculo del use case
  - [x] 3.1 Implementar `calculateEstimatedCommission(totalPendingCollected, pendingCount, rule)`
    - Lógica PERCENTAGE: `totalPendingCollected * (rule.value / 100)`
    - Lógica FIXED: `pendingCount * rule.value`
    - Sin regla activa: retornar `{ estimated_commission: 0, estimated_courier_payment: totalPendingCollected }`
    - _Requisitos: 3.2, 3.3, 3.4, 3.5_

  - [ ]* 3.2 Escribir tests de propiedad para comisión PERCENTAGE
    - **Propiedad 4: Cálculo de comisión PERCENTAGE es correcto**
    - **Valida: Requisitos 3.2, 3.5**
    - Usar `fast-check` con `fc.float({ min: 0, max: 1_000_000 })` y `fc.float({ min: 0, max: 100 })`
    - Verificar `estimated_commission ≈ totalCollected * (ruleValue / 100)` y `estimated_courier_payment ≈ totalCollected - estimated_commission`

  - [ ]* 3.3 Escribir tests de propiedad para comisión FIXED
    - **Propiedad 5: Cálculo de comisión FIXED es correcto**
    - **Valida: Requisitos 3.3, 3.5**
    - Usar `fast-check` con `fc.nat()` para `pendingCount` y `fc.float({ min: 0 })` para `rule.value`
    - Verificar `estimated_commission = pendingCount * rule.value` y `estimated_courier_payment = totalCollected - estimated_commission`

  - [x] 3.4 Implementar `consolidate(settled, pending)`
    - Calcular `total.total_services`, `total.total_collected`, `total.company_commission`, `total.courier_payment`
    - Calcular `summary.settlement_rate` con redondeo a 1 decimal y protección contra división por cero
    - Calcular `summary.pending_amount = total.total_collected - settled.total_collected`
    - _Requisitos: 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ]* 3.5 Escribir tests de propiedad para la consolidación total
    - **Propiedad 6: Consolidación total es suma de partes**
    - **Valida: Requisitos 4.2, 4.3, 4.4, 4.5**
    - Usar `fast-check` con registros de `settled` y `pending` con valores no negativos
    - Verificar las cuatro ecuaciones de `total`

  - [ ]* 3.6 Escribir tests de propiedad para settlement_rate
    - **Propiedad 7: settlement_rate es ratio correcto y evita división por cero**
    - **Valida: Requisitos 4.6, 4.7**
    - Usar `fast-check` con `fc.float({ min: 0, max: 1_000_000 })` para `settledCollected` y `pendingCollected`
    - Verificar que `rate ∈ [0, 100]`, que sea 0 cuando `totalCollected = 0`, y que sea el ratio correcto en caso contrario

- [x] 4. Implementar `ReporteFinancieroHibridoUseCase`
  - [x] 4.1 Crear `src/modules/reportes/application/use-cases/reporte-financiero-hibrido.use-case.ts`
    - Definir e exportar la interfaz `FinancialReportHibridoResult` con secciones `period`, `settled`, `pending`, `total` y `summary`
    - Inyectar `ReportesHibridoRepository` y `CacheService` en el constructor
    - _Requisitos: 4.8, 5.1_

  - [x] 4.2 Implementar el método `execute(query, company_id)`
    - Validar que `from` y `to` estén presentes; lanzar `AppException` si faltan
    - Validar que `from < to`; lanzar `AppException` si no se cumple
    - Construir la clave de caché `reporte:financiero:hybrid:{company_id}:{from}:{to}` y consultar `CacheService`
    - Si hay cache hit, retornar el resultado cacheado
    - Si hay cache miss, ejecutar las cinco queries en paralelo con `Promise.all`
    - Calcular `estimated_commission` usando `calculateEstimatedCommission`
    - Consolidar con `consolidate` y guardar en caché con TTL 300 s
    - _Requisitos: 4.1, 5.1, 5.2, 5.3, 6.1, 6.2_

  - [ ]* 4.3 Escribir tests de propiedad para la estructura de respuesta
    - **Propiedad 8: Estructura de respuesta contiene todas las secciones requeridas**
    - **Valida: Requisito 4.8**
    - Mockear el repositorio con valores arbitrarios generados por `fast-check`
    - Verificar que el resultado siempre tenga `period`, `settled`, `pending`, `total` y `summary` con todos sus campos numéricos presentes y no nulos

  - [ ]* 4.4 Escribir tests de propiedad para la validación de parámetros
    - **Propiedad 9: Validación de parámetros rechaza rangos inválidos**
    - **Valida: Requisitos 6.1, 6.2, 6.3**
    - Usar `fast-check` para generar pares de fechas donde `from >= to` o donde alguna esté ausente
    - Verificar que el use case lanza `AppException` y no ejecuta ninguna query

  - [ ]* 4.5 Escribir tests de propiedad para la clave de caché
    - **Propiedad 10: Clave de caché es determinista y única por contexto**
    - **Valida: Requisito 5.1**
    - Usar `fast-check` para generar combinaciones de `company_id`, `from` y `to`
    - Verificar que la clave tiene el formato correcto y que combinaciones distintas producen claves distintas

  - [ ]* 4.6 Escribir tests de ejemplo para el use case
    - Cache hit: mock de `CacheService.get` retorna resultado → no se llama al repositorio
    - Cache miss: mock retorna `null` → se llama al repositorio y se guarda con TTL 300
    - Sin `SettlementRule` activa: `getActiveRule` retorna `null` → `estimated_commission = 0`
    - _Requisitos: 3.4, 5.2, 5.3_

- [x] 5. Registrar los nuevos providers en `reportes.module.ts`
  - Agregar `ReportesHibridoRepository` y `ReporteFinancieroHibridoUseCase` a `providers`
  - Agregar `ReporteFinancieroHibridoUseCase` a `exports`
  - _Requisitos: 7.1, 8.1_

- [x] 6. Agregar el endpoint `GET /api/reports/financial/hybrid` en `reportes.controller.ts`
  - Inyectar `ReporteFinancieroHibridoUseCase` en el constructor del controlador
  - Agregar el método `financialHybrid` con decoradores `@Get('financial/hybrid')`, `@Roles(Role.ADMIN)`, `@ApiOperation`, `@ApiQuery` y `@ApiResponse`
  - El endpoint existente `GET /api/reports/financial` no debe modificarse
  - _Requisitos: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 6.1 Escribir tests de integración para el nuevo endpoint
    - `GET /api/reports/financial/hybrid` con datos reales en DB de test: verificar HTTP 200 y shape de respuesta
    - `GET /api/reports/financial` (legacy) sigue respondiendo HTTP 200 sin cambios
    - Autenticación: 401 sin token, 403 con rol `AUX`
    - Rama de liquidaciones: seed de `CourierSettlement` SETTLED → verificar sums correctos
    - Rama de pendientes: seed de `Service` DELIVERED + `is_settled_courier=false` → verificar sums correctos
    - _Requisitos: 7.2, 7.3, 7.4, 7.5_

- [x] 7. Checkpoint — Verificar backend
  - Asegurarse de que todos los tests del backend pasen. Preguntar al usuario si hay dudas antes de continuar.

- [x] 8. Actualizar `bff-reports.use-case.ts` para usar el use case híbrido
  - Reemplazar la inyección de `ReporteFinancieroUseCase` por `ReporteFinancieroHibridoUseCase`
  - Actualizar el tipo de retorno del campo `financial` de `FinancieroReportResult` a `FinancialReportHibridoResult`
  - Mantener los campos `services` y `customers` sin cambios
  - _Requisitos: 8.1, 8.2, 8.3_

  - [ ]* 8.1 Escribir tests de ejemplo para `BffReportsUseCase`
    - Verificar que `BffReportsUseCase` invoca `ReporteFinancieroHibridoUseCase` (no el legacy)
    - Verificar que los campos `services` y `customers` del BFF no cambian
    - _Requisitos: 8.1, 8.2, 8.3_

- [x] 9. Actualizar los tipos TypeScript del frontend en `src/types/bff.ts`
  - Agregar las interfaces `PaymentMethodBreakdown`, `SettledReportData`, `PendingReportData`, `TotalReportData`, `SummaryData` y `BffFinancialReportHybrid`
  - Actualizar `BffReportsResponse.financial` de `BffFinancialReport` a `BffFinancialReportHybrid`
  - Mantener `BffFinancialReport` en el archivo para no romper otros consumidores (dashboard)
  - _Requisitos: 9.1, 9.2, 9.3_

- [x] 10. Crear los componentes React del frontend
  - [ ] 10.1 Crear `TracKing-frontend/src/features/reportes/components/SettledSection.tsx`
    - Props: `{ data: SettledReportData }`
    - Mostrar `count`, `total_services`, `total_collected`, `company_commission`, `courier_payment` y tabla de `by_payment_method`
    - Estilo verde esmeralda para indicar datos auditados
    - _Requisitos: 10.1_

  - [ ] 10.2 Crear `TracKing-frontend/src/features/reportes/components/PendingSection.tsx`
    - Props: `{ data: PendingReportData }`
    - Mostrar `count`, `total_collected`, `estimated_commission`, `estimated_courier_payment` y tabla de `by_payment_method`
    - Cuando `count > 0`, mostrar indicador visual ámbar que distinga los datos pendientes de los liquidados
    - _Requisitos: 10.2, 10.4_

  - [ ] 10.3 Crear `TracKing-frontend/src/features/reportes/components/ConsolidatedSection.tsx`
    - Props: `{ total: TotalReportData; summary: SummaryData }`
    - Mostrar `total_services`, `total_collected`, `company_commission`, `courier_payment` y `settlement_rate`
    - Cuando `summary.settlement_rate < 100`, mostrar `pending_amount` como monto pendiente de liquidar
    - _Requisitos: 10.3, 10.5_

- [x] 11. Actualizar `ReportsPage.tsx` para usar los nuevos componentes y tipos
  - Reemplazar `import type { BffFinancialReport }` por `BffFinancialReportHybrid`
  - Reemplazar `FinancialModalContent` por la composición de `SettledSection`, `PendingSection` y `ConsolidatedSection` dentro del modal `'Financiero Consolidado'`
  - Actualizar el preview de la tarjeta financiera para mostrar `total.total_collected` y `summary.settlement_rate`
  - Mantener los modales de servicios, mensajeros y clientes favoritos sin cambios
  - _Requisitos: 11.1, 11.2, 11.3_

- [x] 12. Checkpoint final — Verificar integración completa
  - Asegurarse de que todos los tests del backend y del frontend pasen. Verificar que el endpoint legacy `GET /api/reports/financial` sigue funcionando. Preguntar al usuario si hay dudas antes de dar por completada la implementación.

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia los requisitos específicos para trazabilidad
- Los tests de propiedad usan `fast-check` (disponible en el ecosistema TypeScript/Node)
- El endpoint legacy `GET /api/reports/financial` no debe modificarse en ningún momento
- La decisión sobre el índice compuesto `(company_id, status, is_settled_courier, delivery_date)` se pospone hasta tener métricas reales de volumen (ver Requisito 12.4)
