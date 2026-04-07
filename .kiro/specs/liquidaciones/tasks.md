# Tasks — Liquidaciones

## Task List

- [x] 1. Backend — Limpieza del schema y repositorio
  - [x] 1.1 Eliminar `is_settled_customer` del schema Prisma y generar migración
  - [x] 1.2 Actualizar `LiquidacionRepository.markCustomerServicesAsSettled` para usar `payment_status = PAID` en lugar de `is_settled_customer`
  - [x] 1.3 Actualizar `GenerarLiquidacionClienteUseCase` para filtrar por `payment_status = UNPAID` y marcar con `payment_status = PAID`
  - [x] 1.4 Actualizar `GenerarLiquidacionClienteDto` para aceptar `service_ids: string[]` en lugar de `customer_id + rango de fechas`

- [x] 2. Backend — Nuevos métodos en `LiquidacionRepository`
  - [x] 2.1 Implementar `findPendingTodayCourier(company_id, courier_id)` — servicios DELIVERED, is_settled_courier=false, delivery_date del día actual
  - [x] 2.2 Implementar `findCustomersWithUnpaid(company_id)` — clientes con al menos un servicio payment_status=UNPAID, incluyendo conteo
  - [x] 2.3 Implementar `findUnpaidServicesByCustomer(company_id, customer_id, from?, to?)` — servicios UNPAID con filtro de fechas opcional
  - [x] 2.4 Implementar `countCouriersWithPendingToday(company_id)` — conteo de mensajeros con servicios pendientes del día actual
  - [x] 2.5 Implementar `markServicesAsPaid(service_ids, company_id)` — UPDATE payment_status = PAID

- [x] 3. Backend — Nuevos endpoints en `LiquidacionesController`
  - [x] 3.1 Agregar `GET /api/liquidations/courier/:courier_id/pending-today` — roles ADMIN y AUX
  - [x] 3.2 Agregar `GET /api/liquidations/customers/with-unpaid` — roles ADMIN y AUX
  - [x] 3.3 Agregar `GET /api/liquidations/customer/:customer_id/unpaid-services` con query params `from` y `to` — roles ADMIN y AUX
  - [x] 3.4 Actualizar `POST /api/liquidations/generate/customer` para aceptar `service_ids[]` y validar que pertenecen a la empresa

- [x] 4. Backend — BFF de liquidaciones
  - [x] 4.1 Crear `BffLiquidacionesUseCase` en `src/modules/bff-web/application/use-cases/bff-liquidaciones.use-case.ts`
  - [x] 4.2 Agregar endpoint `GET /api/bff/liquidaciones` en `BffWebController` — roles ADMIN y AUX
  - [x] 4.3 Registrar `BffLiquidacionesUseCase` en `BffWebModule`

- [x] 5. Backend — Serialización de Decimales
  - [x] 5.1 Verificar que todos los métodos del repositorio que retornan `delivery_price`, `total_earned` y `total_invoiced` aplican `Number()` antes de retornar
  - [x] 5.2 Agregar helper `toNumber(decimal: Prisma.Decimal | number): number` en el módulo si no existe

- [x] 6. Backend — Tests
  - [x] 6.1 Extender `specs/liquidaciones.spec.ts` con Property 1 (forma del BFF)
  - [x] 6.2 Agregar Property 3 (filtrado por día actual) en `specs/liquidaciones.spec.ts`
  - [x] 6.3 Agregar Property 6 (marcado is_settled_courier) en `specs/liquidaciones.spec.ts`
  - [x] 6.4 Agregar Property 7 (filtrado clientes UNPAID) en `specs/liquidaciones.spec.ts`
  - [x] 6.5 Agregar Property 10 (marcado payment_status=PAID) en `specs/liquidaciones.spec.ts`
  - [x] 6.6 Agregar Property 13 (round-trip Decimal) en `specs/liquidaciones.spec.ts`

- [x] 7. Frontend — Tipos y API client
  - [x] 7.1 Crear `src/features/liquidaciones/types/liquidacion.types.ts` con todos los tipos del diseño
  - [x] 7.2 Crear `src/features/liquidaciones/api/liquidacionesApi.ts` con las llamadas HTTP al BFF y endpoints de liquidaciones

- [x] 8. Frontend — Hooks
  - [x] 8.1 Crear `useLiquidacionesPage` — query al BFF `/api/bff/liquidaciones`
  - [x] 8.2 Crear `usePendingTodayCourier(courierId)` — query a `/api/liquidations/courier/:id/pending-today`
  - [x] 8.3 Crear `useCustomersWithUnpaid` — query a `/api/liquidations/customers/with-unpaid`
  - [x] 8.4 Crear `useUnpaidServices(customerId, from?, to?)` — query a `/api/liquidations/customer/:id/unpaid-services`
  - [x] 8.5 Crear `useGenerarLiquidacionCourier` — mutación a `POST /api/liquidations/generate/courier`
  - [x] 8.6 Crear `useGenerarLiquidacionCliente` — mutación a `POST /api/liquidations/generate/customer`
  - [x] 8.7 Crear `useUpdateRegla` — mutación a `POST /api/liquidations/rules`

- [x] 9. Frontend — Componente `ReglaLiquidacionCard`
  - [x] 9.1 Crear `src/features/liquidaciones/components/ReglaLiquidacionCard.tsx` — muestra tipo y valor de la regla activa con campo editable para el porcentaje

- [x] 10. Frontend — Componente `LiquidacionMensajeroModal`
  - [x] 10.1 Crear `src/features/liquidaciones/components/LiquidacionMensajeroModal.tsx`
  - [x] 10.2 Implementar lista de mensajeros con estado (AVAILABLE/UNAVAILABLE seleccionables, IN_SERVICE deshabilitado)
  - [x] 10.3 Implementar tabla de servicios pendientes del día con columnas: ID Pedido, Cliente, Hora de entrega, Tipo de Pago, Valor
  - [x] 10.4 Implementar panel de cálculo: Total Recaudado, Porcentaje de Comisión, Monto Comisión, Total a Pagar
  - [x] 10.5 Implementar estado vacío cuando no hay servicios pendientes del día
  - [x] 10.6 Implementar alerta cuando hay servicios de días anteriores sin liquidar
  - [x] 10.7 Implementar botón "Cerrar Liquidación" con lógica de habilitación/deshabilitación
  - [x] 10.8 Implementar opción "Generar Comprobante" post-liquidación (window.print o jsPDF)

- [x] 11. Frontend — Componente `LiquidacionClienteModal`
  - [x] 11.1 Crear `src/features/liquidaciones/components/LiquidacionClienteModal.tsx`
  - [x] 11.2 Implementar lista de clientes con servicios UNPAID (nombre + conteo)
  - [x] 11.3 Implementar filtro de fechas (from/to) para servicios del cliente
  - [x] 11.4 Implementar tabla de servicios UNPAID con checkboxes de selección individual
  - [x] 11.5 Implementar cálculo del total en tiempo real al cambiar selección
  - [x] 11.6 Implementar botón "Cerrar Liquidación" deshabilitado cuando no hay servicios seleccionados

- [x] 12. Frontend — `LiquidacionesPage`
  - [x] 12.1 Crear `src/features/liquidaciones/pages/LiquidacionesPage.tsx`
  - [x] 12.2 Implementar los dos botones de flujo: "Liquidación Mensajero" y "Liquidación Cliente"
  - [x] 12.3 Integrar `ReglaLiquidacionCard` con edición inline del porcentaje
  - [x] 12.4 Mostrar indicador de mensajeros con liquidaciones pendientes del día (`pendientes_hoy`)
  - [x] 12.5 Implementar configuración de hora de alerta diaria (almacenada en localStorage)
  - [x] 12.6 Implementar lógica de notificación cuando llega la hora configurada y hay pendientes

- [x] 13. Frontend — Componente `AsignarMensajeroModal`
  - [x] 13.1 Crear `src/features/servicios/components/AsignarMensajeroModal.tsx` — lista solo mensajeros AVAILABLE con nombre, teléfono y estado
  - [x] 13.2 Implementar callback `onSelect(courier_id)` al seleccionar un mensajero
  - [x] 13.3 Integrar `AsignarMensajeroModal` en `CrearServicioPage` (botón "Asignar Mensajero", no obligatorio)
  - [x] 13.4 Integrar `AsignarMensajeroModal` en la tabla de servicios (acción de asignación)

- [x] 14. Frontend — Fix `PaymentMethod` en formulario de creación de servicios
  - [x] 14.1 Actualizar el selector de método de pago en `CrearServicioPage` para usar los valores `CASH`, `TRANSFER`, `CREDIT`
  - [x] 14.2 Agregar etiquetas en español: CASH → "Efectivo", TRANSFER → "Transferencia", CREDIT → "Crédito"

- [x] 15. Frontend — Tests
  - [x] 15.1 Agregar Property 9 (cálculo total cliente en tiempo real) en tests de `LiquidacionClienteModal`
  - [x] 15.2 Agregar Property 11 (mapeo PaymentMethod) en tests de `CrearServicioPage`
  - [x] 15.3 Agregar tests de ejemplo para `LiquidacionesPage` (renderizado de botones, indicador de pendientes)
  - [x] 15.4 Agregar tests de ejemplo para `LiquidacionMensajeroModal` (estado vacío, mensajero IN_SERVICE deshabilitado)
