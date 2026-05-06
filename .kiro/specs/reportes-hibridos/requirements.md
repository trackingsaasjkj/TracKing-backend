# Documento de Requisitos

## Introducción

El módulo de reportes financieros de TracKing actualmente consulta únicamente la tabla `Service` y recalcula todo en tiempo real, sin distinguir entre servicios liquidados y pendientes. Esto genera degradación de performance, inconsistencia de fechas entre `delivery_date` y `generation_date`, y falta de trazabilidad.

Esta funcionalidad refactoriza el reporte financiero para usar un **enfoque híbrido** que combina:

1. **Rama liquidaciones** — consulta `CourierSettlement` con `status = 'SETTLED'` para datos pre-agregados, auditables y rápidos.
2. **Rama pendientes** — consulta `Service` con `status = 'DELIVERED'` e `is_settled_courier = false` para datos en tiempo real.
3. **Consolidación en memoria** — agrega ambas ramas y expone una vista unificada con desglose por método de pago, tasa de liquidación y estimaciones.

El cambio introduce un nuevo use case (`ReporteFinancieroHibridoUseCase`), un nuevo repositorio (`ReportesHibridoRepository`), un nuevo endpoint `GET /api/reports/financial/hybrid`, actualiza el BFF para usar el nuevo use case, y agrega tres nuevos componentes en el frontend (`SettledSection`, `PendingSection`, `ConsolidatedSection`).

---

## Glosario

- **Hybrid_Report_System**: El sistema de reportes financieros híbrido descrito en este documento.
- **ReportesHibridoRepository**: Repositorio NestJS que ejecuta las queries Prisma para la rama de liquidaciones y la rama de pendientes.
- **ReporteFinancieroHibridoUseCase**: Use case NestJS que orquesta las queries, consolida los resultados y gestiona el caché.
- **BffReportsUseCase**: Use case del BFF Web que delega al `ReporteFinancieroHibridoUseCase`.
- **SettledSection**: Componente React que renderiza los datos de liquidaciones completadas.
- **PendingSection**: Componente React que renderiza los servicios pendientes de liquidar.
- **ConsolidatedSection**: Componente React que renderiza el consolidado total y la tasa de liquidación.
- **CourierSettlement**: Modelo Prisma que representa una liquidación de mensajero con campos `status`, `generation_date`, `total_services`, `total_collected`, `company_commission`, `courier_payment`.
- **Service**: Modelo Prisma que representa un servicio de mensajería con campos `status`, `delivery_date`, `is_settled_courier`, `delivery_price`, `payment_method`.
- **SettlementRule**: Modelo Prisma que define la regla de comisión activa (`PERCENTAGE` o `FIXED`).
- **Date_Range**: Par de fechas `from` / `to` en formato ISO 8601 que delimita el período del reporte.
- **CacheService**: Servicio de caché en memoria disponible en `src/infrastructure/cache/cache.service.ts`.
- **BffFinancialReportHybrid**: Tipo TypeScript del frontend que representa la respuesta del nuevo endpoint híbrido.

---

## Requisitos

### Requisito 1: Consulta de liquidaciones completadas

**User Story:** Como administrador, quiero ver los datos de liquidaciones ya cerradas en el reporte financiero, para tener información auditada y pre-agregada del período seleccionado.

#### Criterios de Aceptación

1. WHEN el administrador solicita el reporte financiero híbrido con un `Date_Range` válido, THE `ReportesHibridoRepository` SHALL consultar `CourierSettlement` filtrando por `company_id`, `status = 'SETTLED'` y `generation_date` dentro del `Date_Range`.
2. WHEN la consulta de liquidaciones se ejecuta, THE `ReportesHibridoRepository` SHALL retornar la suma de `total_services`, `total_collected`, `company_commission` y `courier_payment` de todos los registros `CourierSettlement` que cumplan el filtro.
3. WHEN la consulta de liquidaciones se ejecuta, THE `ReportesHibridoRepository` SHALL retornar el conteo de liquidaciones (`count`) que cumplan el filtro.
4. WHEN la consulta de liquidaciones por método de pago se ejecuta, THE `ReportesHibridoRepository` SHALL hacer JOIN entre `CourierSettlement`, `SettlementService` y `Service` para agrupar `delivery_price` por `payment_method` de los servicios incluidos en liquidaciones `SETTLED` dentro del `Date_Range`.
5. IF no existen liquidaciones `SETTLED` en el `Date_Range`, THEN THE `ReportesHibridoRepository` SHALL retornar ceros en todos los campos numéricos de la rama de liquidaciones.

---

### Requisito 2: Consulta de servicios pendientes de liquidar

**User Story:** Como administrador, quiero ver los servicios entregados que aún no han sido liquidados, para conocer el monto pendiente en tiempo real.

#### Criterios de Aceptación

1. WHEN el administrador solicita el reporte financiero híbrido con un `Date_Range` válido, THE `ReportesHibridoRepository` SHALL consultar `Service` filtrando por `company_id`, `status = 'DELIVERED'`, `is_settled_courier = false` y `delivery_date` dentro del `Date_Range`.
2. WHEN la consulta de pendientes se ejecuta, THE `ReportesHibridoRepository` SHALL retornar la suma de `delivery_price` y el conteo de servicios que cumplan el filtro.
3. WHEN la consulta de pendientes por método de pago se ejecuta, THE `ReportesHibridoRepository` SHALL agrupar los servicios pendientes por `payment_method` y retornar la suma de `delivery_price` y el conteo por grupo.
4. IF no existen servicios pendientes en el `Date_Range`, THEN THE `ReportesHibridoRepository` SHALL retornar ceros en todos los campos numéricos de la rama de pendientes.

---

### Requisito 3: Estimación de comisión para servicios pendientes

**User Story:** Como administrador, quiero ver una estimación de la comisión que generarían los servicios pendientes si se liquidaran hoy, para proyectar los ingresos futuros.

#### Criterios de Aceptación

1. WHEN el `ReporteFinancieroHibridoUseCase` consolida los resultados, THE `ReporteFinancieroHibridoUseCase` SHALL consultar la `SettlementRule` activa (`active = true`) de la empresa para calcular la comisión estimada de los servicios pendientes.
2. WHEN la `SettlementRule` activa es de tipo `PERCENTAGE`, THE `ReporteFinancieroHibridoUseCase` SHALL calcular `estimated_commission = total_pending_collected * (rule.value / 100)`.
3. WHEN la `SettlementRule` activa es de tipo `FIXED`, THE `ReporteFinancieroHibridoUseCase` SHALL calcular `estimated_commission = pending_count * rule.value`.
4. IF no existe una `SettlementRule` activa para la empresa, THEN THE `ReporteFinancieroHibridoUseCase` SHALL usar `estimated_commission = 0` y continuar sin lanzar error.
5. WHEN se calcula la estimación, THE `ReporteFinancieroHibridoUseCase` SHALL calcular `estimated_courier_payment = total_pending_collected - estimated_commission`.

---

### Requisito 4: Consolidación en memoria y estructura de respuesta

**User Story:** Como administrador, quiero ver un consolidado que sume liquidaciones y pendientes, para tener una visión completa del período.

#### Criterios de Aceptación

1. WHEN el `ReporteFinancieroHibridoUseCase` recibe los resultados de ambas ramas, THE `ReporteFinancieroHibridoUseCase` SHALL ejecutar las cuatro queries (liquidaciones, pendientes, liquidaciones por método de pago, pendientes por método de pago) en paralelo usando `Promise.all`.
2. WHEN se consolidan los resultados, THE `ReporteFinancieroHibridoUseCase` SHALL calcular `total.total_services = settled.total_services + pending.count`.
3. WHEN se consolidan los resultados, THE `ReporteFinancieroHibridoUseCase` SHALL calcular `total.total_collected = settled.total_collected + pending.total_collected`.
4. WHEN se consolidan los resultados, THE `ReporteFinancieroHibridoUseCase` SHALL calcular `total.company_commission = settled.company_commission + pending.estimated_commission`.
5. WHEN se consolidan los resultados, THE `ReporteFinancieroHibridoUseCase` SHALL calcular `total.courier_payment = settled.courier_payment + pending.estimated_courier_payment`.
6. WHEN se consolidan los resultados y `total.total_collected > 0`, THE `ReporteFinancieroHibridoUseCase` SHALL calcular `summary.settlement_rate = (settled.total_collected / total.total_collected) * 100` redondeado a un decimal.
7. IF `total.total_collected = 0`, THEN THE `ReporteFinancieroHibridoUseCase` SHALL asignar `summary.settlement_rate = 0` sin realizar división.
8. THE `ReporteFinancieroHibridoUseCase` SHALL retornar un objeto con las secciones `period`, `settled`, `pending`, `total` y `summary` tal como se define en `FinancialReportHibridoResult`.

---

### Requisito 5: Caché de resultados

**User Story:** Como administrador, quiero que el reporte responda en menos de 500 ms cuando ya fue calculado recientemente, para no esperar en consultas repetidas.

#### Criterios de Aceptación

1. WHEN el `ReporteFinancieroHibridoUseCase` recibe una solicitud, THE `ReporteFinancieroHibridoUseCase` SHALL construir la clave de caché con el formato `reporte:financiero:hybrid:{company_id}:{from}:{to}` y consultar el `CacheService` antes de ejecutar las queries.
2. WHEN existe un resultado en caché para la clave construida, THE `ReporteFinancieroHibridoUseCase` SHALL retornar el resultado cacheado sin ejecutar ninguna query a la base de datos.
3. WHEN no existe resultado en caché, THE `ReporteFinancieroHibridoUseCase` SHALL ejecutar las queries, consolidar el resultado y almacenarlo en el `CacheService` con un TTL de 300 segundos.
4. WHILE el resultado está en caché, THE `Hybrid_Report_System` SHALL responder en menos de 500 ms para el mismo `Date_Range` y `company_id`.

---

### Requisito 6: Validación de parámetros de entrada

**User Story:** Como administrador, quiero recibir mensajes de error claros cuando los parámetros del reporte son inválidos, para corregirlos rápidamente.

#### Criterios de Aceptación

1. WHEN el `ReporteFinancieroHibridoUseCase` recibe una solicitud sin `from` o sin `to`, THE `ReporteFinancieroHibridoUseCase` SHALL lanzar un `AppException` con el mensaje `'Los parámetros from y to son obligatorios para el reporte financiero híbrido'`.
2. WHEN el `ReporteFinancieroHibridoUseCase` recibe `from >= to`, THE `ReporteFinancieroHibridoUseCase` SHALL lanzar un `AppException` con el mensaje `'from debe ser anterior a to'`.
3. WHEN el `BffReportsUseCase` recibe una solicitud sin `from` o sin `to`, THE `BffReportsUseCase` SHALL lanzar un `AppException` con el mensaje `'Los parámetros from y to son obligatorios'` antes de invocar el use case de reporte.

---

### Requisito 7: Nuevo endpoint REST

**User Story:** Como desarrollador del frontend, quiero un endpoint dedicado para el reporte híbrido, para consumirlo de forma independiente al endpoint de reportes existente.

#### Criterios de Aceptación

1. THE `Hybrid_Report_System` SHALL exponer el endpoint `GET /api/reports/financial/hybrid` en el `ReportesController`.
2. WHEN se recibe una solicitud a `GET /api/reports/financial/hybrid`, THE `Hybrid_Report_System` SHALL requerir autenticación JWT y el rol `ADMIN`.
3. WHEN se recibe una solicitud válida a `GET /api/reports/financial/hybrid`, THE `Hybrid_Report_System` SHALL retornar un objeto `FinancialReportHibridoResult` con código HTTP 200.
4. WHEN se recibe una solicitud inválida a `GET /api/reports/financial/hybrid`, THE `Hybrid_Report_System` SHALL retornar código HTTP 400 con el mensaje de error correspondiente.
5. THE `Hybrid_Report_System` SHALL mantener el endpoint `GET /api/reports/financial` existente sin modificaciones para garantizar compatibilidad hacia atrás.

---

### Requisito 8: Actualización del BFF Web

**User Story:** Como desarrollador del frontend, quiero que el BFF use el nuevo reporte híbrido, para que la página de reportes muestre datos liquidados y pendientes sin cambiar la URL del BFF.

#### Criterios de Aceptación

1. WHEN el `BffReportsUseCase` ejecuta el reporte financiero, THE `BffReportsUseCase` SHALL invocar `ReporteFinancieroHibridoUseCase` en lugar de `ReporteFinancieroUseCase`.
2. WHEN el `BffReportsUseCase` retorna la respuesta, THE `BffReportsUseCase` SHALL incluir el campo `financial` con la estructura `FinancialReportHibridoResult` en lugar de `FinancieroReportResult`.
3. THE `BffReportsUseCase` SHALL mantener los campos `services` y `customers` sin cambios en la respuesta del BFF.

---

### Requisito 9: Tipos TypeScript del frontend

**User Story:** Como desarrollador del frontend, quiero tipos TypeScript actualizados para el reporte híbrido, para tener autocompletado y validación en tiempo de compilación.

#### Criterios de Aceptación

1. THE `Hybrid_Report_System` SHALL definir la interfaz `BffFinancialReportHybrid` en `TracKing-frontend/src/types/bff.ts` con las secciones `period`, `settled`, `pending`, `total` y `summary`.
2. THE `Hybrid_Report_System` SHALL definir las interfaces auxiliares `SettledReportData`, `PendingReportData`, `TotalReportData`, `SummaryData` y `PaymentMethodBreakdown` en el mismo archivo.
3. WHEN se actualiza `BffReportsResponse`, THE `Hybrid_Report_System` SHALL cambiar el tipo del campo `financial` de `BffFinancialReport` a `BffFinancialReportHybrid`.

---

### Requisito 10: Componentes React del frontend

**User Story:** Como administrador, quiero ver el reporte financiero dividido en tres secciones visuales (liquidadas, pendientes, consolidado), para entender claramente el estado financiero del período.

#### Criterios de Aceptación

1. THE `Hybrid_Report_System` SHALL crear el componente `SettledSection` en `TracKing-frontend/src/features/reportes/components/SettledSection.tsx` que reciba `SettledReportData` como prop y muestre `count`, `total_services`, `total_collected`, `company_commission`, `courier_payment` y el desglose `by_payment_method`.
2. THE `Hybrid_Report_System` SHALL crear el componente `PendingSection` en `TracKing-frontend/src/features/reportes/components/PendingSection.tsx` que reciba `PendingReportData` como prop y muestre `count`, `total_collected`, `estimated_commission`, `estimated_courier_payment` y el desglose `by_payment_method`.
3. THE `Hybrid_Report_System` SHALL crear el componente `ConsolidatedSection` en `TracKing-frontend/src/features/reportes/components/ConsolidatedSection.tsx` que reciba `TotalReportData` y `SummaryData` como props y muestre `total_services`, `total_collected`, `company_commission`, `courier_payment` y `settlement_rate`.
4. WHEN `PendingSection` recibe `count > 0`, THE `PendingSection` SHALL mostrar un indicador visual (color ámbar o etiqueta) que distinga los datos pendientes de los liquidados.
5. WHEN `ConsolidatedSection` recibe `summary.settlement_rate < 100`, THE `ConsolidatedSection` SHALL mostrar `pending_amount` como monto pendiente de liquidar.

---

### Requisito 11: Actualización de ReportsPage

**User Story:** Como administrador, quiero que la página de reportes muestre las tres secciones del reporte híbrido dentro del modal financiero existente, para no tener que navegar a una página diferente.

#### Criterios de Aceptación

1. WHEN `ReportsPage` recibe datos del BFF con la nueva estructura híbrida, THE `ReportsPage` SHALL renderizar `SettledSection`, `PendingSection` y `ConsolidatedSection` dentro del modal `'Financiero Consolidado'` en lugar del componente `FinancialModalContent` actual.
2. WHEN `ReportsPage` muestra el preview de la tarjeta financiera, THE `ReportsPage` SHALL mostrar `total.total_collected` formateado y `summary.settlement_rate` como porcentaje.
3. THE `ReportsPage` SHALL mantener los modales de servicios, mensajeros y clientes favoritos sin cambios.

---

### Requisito 12: Índices de base de datos

**User Story:** Como desarrollador, quiero que las queries del reporte híbrido usen índices existentes, para garantizar tiempos de respuesta aceptables sin migraciones adicionales.

#### Criterios de Aceptación

1. THE `ReportesHibridoRepository` SHALL usar el índice `@@index([company_id, generation_date(sort: Desc)])` de `CourierSettlement` en la query de liquidaciones completadas.
2. THE `ReportesHibridoRepository` SHALL usar el índice `@@index([company_id, status, delivery_date])` de `Service` en la query de servicios pendientes.
3. THE `ReportesHibridoRepository` SHALL usar el índice `@@index([company_id, is_settled_courier])` de `Service` en el filtro `is_settled_courier = false`.
4. IF se requiere un índice compuesto `(company_id, status, is_settled_courier, delivery_date)` que no existe en el schema actual, THEN THE `Hybrid_Report_System` SHALL agregar dicho índice en `schema.prisma` y generar la migración correspondiente antes de desplegar.
