# Requirements Document — Liquidaciones

## Introduction

El módulo de Liquidaciones permite al administrador de una empresa courier gestionar dos tipos de liquidaciones:

1. **Liquidación de Mensajeros**: calcula el pago a cada mensajero por los servicios entregados en un día, aplicando un porcentaje de comisión configurable. Las liquidaciones son por jornada diaria. Solo se incluyen servicios con `is_settled_courier = false`.

2. **Liquidación de Clientes**: permite cobrar a los clientes los servicios con `payment_status = UNPAID`. Los servicios se seleccionan individualmente y se puede filtrar por rango de fechas.

Adicionalmente, se corrige un bug en la página de creación de servicios relacionado con el enum `PaymentMethod`, y se agrega un componente reutilizable `AsignarMensajeroModal`.

El stack es NestJS + Prisma + PostgreSQL en el backend y React/Next.js en el frontend, siguiendo la arquitectura modular con use-cases ya establecida en el proyecto.

---

## Glossary

- **Sistema**: el sistema TracKing en su conjunto (backend + frontend).
- **LiquidacionesPage**: página única del frontend que contiene los dos flujos de liquidación.
- **LiquidacionMensajeroModal**: modal del frontend que gestiona la liquidación de un mensajero.
- **LiquidacionClienteModal**: modal del frontend que gestiona la liquidación de un cliente.
- **AsignarMensajeroModal**: componente modal reutilizable para seleccionar un mensajero disponible.
- **LiquidacionRepository**: repositorio de infraestructura del módulo de liquidaciones en el backend.
- **BffLiquidacionesUseCase**: use-case del BFF que agrega los datos necesarios para la página de liquidaciones.
- **Jornada**: período de trabajo de un mensajero en un día. Un mensajero puede tener múltiples jornadas en un día.
- **Servicio_Pendiente_Mensajero**: servicio con `status = DELIVERED` e `is_settled_courier = false`.
- **Servicio_Pendiente_Cliente**: servicio con `payment_status = UNPAID`.
- **Regla_Activa**: registro `SettlementRule` con `active = true` para la empresa.
- **Comision**: porcentaje o monto fijo que retiene la empresa sobre el `delivery_price` de cada servicio.
- **Total_A_Pagar**: resultado de restar la comisión al total recaudado por el mensajero.
- **PaymentMethod**: enum con valores `CASH`, `TRANSFER`, `CREDIT`.
- **PaymentStatus**: enum con valores `PAID`, `UNPAID`.

---

## Requirements

### Requirement 1: Página de Liquidaciones con dos flujos

**User Story:** Como administrador, quiero una página de liquidaciones con acceso a los flujos de mensajeros y clientes, para gestionar ambos tipos de cobro desde un solo lugar.

#### Acceptance Criteria

1. THE LiquidacionesPage SHALL mostrar dos botones: "Liquidación Mensajero" y "Liquidación Cliente".
2. WHEN el administrador hace clic en "Liquidación Mensajero", THE LiquidacionesPage SHALL abrir el LiquidacionMensajeroModal.
3. WHEN el administrador hace clic en "Liquidación Cliente", THE LiquidacionesPage SHALL abrir el LiquidacionClienteModal.
4. THE LiquidacionesPage SHALL mostrar la Regla_Activa vigente con un campo editable para modificar el porcentaje de comisión directamente desde la página.
5. WHEN el administrador modifica el porcentaje de comisión en la página, THE Sistema SHALL actualizar la Regla_Activa de la empresa mediante el endpoint `POST /api/liquidations/rules`.

---

### Requirement 2: Modal de selección de mensajero para liquidación

**User Story:** Como administrador, quiero ver la lista de mensajeros disponibles al iniciar una liquidación, para seleccionar a quién liquidar.

#### Acceptance Criteria

1. WHEN el LiquidacionMensajeroModal se abre, THE Sistema SHALL cargar todos los mensajeros de la empresa con `operational_status` igual a `AVAILABLE` o `UNAVAILABLE`.
2. THE LiquidacionMensajeroModal SHALL mostrar cada mensajero con su nombre y estado operacional.
3. WHILE un mensajero tiene `operational_status = IN_SERVICE`, THE LiquidacionMensajeroModal SHALL mostrar ese mensajero como no seleccionable (deshabilitado).
4. WHEN el administrador selecciona un mensajero, THE LiquidacionMensajeroModal SHALL cargar los datos de liquidación de ese mensajero.

---

### Requirement 3: Visualización de datos del mensajero seleccionado

**User Story:** Como administrador, quiero ver un resumen de los servicios pendientes de liquidar del mensajero seleccionado, para tener contexto antes de cerrar la liquidación.

#### Acceptance Criteria

1. WHEN un mensajero es seleccionado en el LiquidacionMensajeroModal, THE Sistema SHALL mostrar tres cards: "Servicios Realizados" (conteo), "Efectivo en Mano" (suma de `delivery_price`), y "Promedio Servicio" (promedio de `delivery_price`).
2. WHEN un mensajero es seleccionado, THE Sistema SHALL mostrar una tabla con los Servicios_Pendientes_Mensajero del mensajero, con columnas: ID Pedido, Cliente, Hora de entrega, Tipo de Pago, Valor.
3. THE Sistema SHALL filtrar los servicios mostrados por `delivery_date` correspondiente al día actual (00:00 a 23:59), usando únicamente los servicios con `is_settled_courier = false`.
4. IF el mensajero no tiene Servicios_Pendientes_Mensajero para el día actual, THEN THE LiquidacionMensajeroModal SHALL mostrar un estado vacío con el mensaje "No hay servicios pendientes de liquidar para hoy".
5. THE Sistema SHALL mostrar el panel de "Cálculo de Liquidación" con: Total Recaudado, Porcentaje de Comisión (editable), Monto Comisión calculado, y Total a Pagar.

---

### Requirement 4: Cálculo y cierre de liquidación de mensajero

**User Story:** Como administrador, quiero calcular y cerrar la liquidación de un mensajero, para registrar el pago y marcar los servicios como liquidados.

#### Acceptance Criteria

1. WHEN la Regla_Activa es de tipo `PERCENTAGE`, THE Sistema SHALL calcular el Total_A_Pagar como: `suma(delivery_price) * (1 - comision / 100)`.
2. WHEN la Regla_Activa es de tipo `FIXED`, THE Sistema SHALL calcular el Total_A_Pagar como: `suma(delivery_price) - (valor_fijo * cantidad_servicios)`.
3. WHEN el administrador hace clic en "Cerrar Liquidación", THE Sistema SHALL invocar `POST /api/liquidations/generate/courier` con `courier_id`, `start_date` y `end_date` del día actual.
4. WHEN la liquidación se genera exitosamente, THE Sistema SHALL marcar todos los Servicios_Pendientes_Mensajero incluidos con `is_settled_courier = true`.
5. IF no existe una Regla_Activa para la empresa, THEN THE Sistema SHALL mostrar un mensaje de error indicando que se debe configurar una regla de liquidación.
6. IF el mensajero no tiene Servicios_Pendientes_Mensajero, THEN THE Sistema SHALL deshabilitar el botón "Cerrar Liquidación".
7. WHEN la liquidación se genera exitosamente, THE Sistema SHALL mostrar una notificación de éxito y ofrecer la opción de "Generar Comprobante".

---

### Requirement 5: Restricción de servicios por día (mensajero)

**User Story:** Como administrador, quiero que las liquidaciones de mensajeros sean estrictamente por día, para mantener la trazabilidad diaria de pagos.

#### Acceptance Criteria

1. THE Sistema SHALL filtrar los Servicios_Pendientes_Mensajero exclusivamente por `delivery_date` del día actual (no por fecha de creación).
2. THE Sistema SHALL NO permitir mezclar servicios de días distintos en una misma liquidación de mensajero.
3. IF un mensajero tiene servicios de días anteriores con `is_settled_courier = false`, THEN THE Sistema SHALL mostrar una alerta indicando que existen servicios de días anteriores sin liquidar.
4. THE LiquidacionMensajeroModal SHALL NO mostrar un selector de fecha, ya que siempre opera sobre el día actual pendiente.

---

### Requirement 6: Alerta de mensajeros sin liquidar

**User Story:** Como administrador, quiero recibir una alerta a una hora configurable cuando hay mensajeros con servicios sin liquidar, para no olvidar cerrar las liquidaciones del día.

#### Acceptance Criteria

1. THE Sistema SHALL permitir al administrador configurar una hora de alerta diaria (formato HH:MM) desde la LiquidacionesPage.
2. WHEN la hora configurada llega y existen mensajeros con Servicios_Pendientes_Mensajero del día actual, THE Sistema SHALL mostrar una notificación en la interfaz web indicando los mensajeros pendientes.
3. THE LiquidacionesPage SHALL mostrar un indicador del número de mensajeros con liquidaciones pendientes del día.

---

### Requirement 7: Modal de selección de cliente para liquidación

**User Story:** Como administrador, quiero ver solo los clientes con servicios pendientes de cobro al iniciar una liquidación de cliente, para no mostrar clientes sin deuda.

#### Acceptance Criteria

1. WHEN el LiquidacionClienteModal se abre, THE Sistema SHALL cargar únicamente los clientes que tengan al menos un servicio con `payment_status = UNPAID`.
2. THE LiquidacionClienteModal SHALL mostrar cada cliente con su nombre y el número de servicios pendientes de cobro.
3. WHEN el administrador selecciona un cliente, THE LiquidacionClienteModal SHALL cargar los servicios con `payment_status = UNPAID` de ese cliente.
4. THE Sistema SHALL permitir filtrar los servicios del cliente por rango de fechas (desde/hasta) usando `delivery_date`.

---

### Requirement 8: Selección individual de servicios y cálculo de liquidación de cliente

**User Story:** Como administrador, quiero seleccionar individualmente los servicios a cobrar al cliente, para permitir pagos parciales.

#### Acceptance Criteria

1. THE LiquidacionClienteModal SHALL mostrar una tabla de servicios con `payment_status = UNPAID` del cliente seleccionado, con columnas: ID Pedido, Fecha de entrega, Tipo de Pago, Valor, y un checkbox de selección.
2. THE Sistema SHALL permitir al administrador seleccionar y deseleccionar servicios individualmente mediante checkboxes.
3. THE Sistema SHALL calcular el total de la liquidación como la suma de `delivery_price` de los servicios seleccionados, actualizándose en tiempo real al cambiar la selección.
4. WHEN el administrador hace clic en "Cerrar Liquidación", THE Sistema SHALL invocar `POST /api/liquidations/generate/customer` con los `service_ids` seleccionados.
5. WHEN la liquidación de cliente se genera exitosamente, THE Sistema SHALL actualizar el `payment_status` de los servicios incluidos a `PAID`.
6. IF el administrador no selecciona ningún servicio, THEN THE Sistema SHALL deshabilitar el botón "Cerrar Liquidación".

---

### Requirement 9: Gestión del campo `is_settled_customer` y `payment_status`

**User Story:** Como desarrollador, quiero que el filtrado de servicios para liquidación de clientes use `payment_status` como campo principal, para mantener consistencia con el modelo de datos.

#### Acceptance Criteria

1. THE Sistema SHALL usar `payment_status = UNPAID` como criterio principal para identificar servicios pendientes de cobro al cliente.
2. WHEN una liquidación de cliente se genera, THE Sistema SHALL actualizar `payment_status` a `PAID` en todos los servicios incluidos.
3. THE Sistema SHALL evaluar si `is_settled_customer` es redundante con `payment_status`; si el filtrado se realiza exclusivamente por `payment_status`, THE Sistema SHALL eliminar `is_settled_customer` del schema de Prisma y toda la lógica asociada en el repositorio y use-cases.

---

### Requirement 10: Nuevo endpoint BFF para la página de liquidaciones

**User Story:** Como desarrollador frontend, quiero un endpoint BFF que agregue todos los datos necesarios para la LiquidacionesPage en una sola llamada, para reducir la latencia y simplificar el código del frontend.

#### Acceptance Criteria

1. THE BffLiquidacionesUseCase SHALL retornar en una sola respuesta: lista de mensajeros (AVAILABLE y UNAVAILABLE), Regla_Activa, y conteo de mensajeros con Servicios_Pendientes_Mensajero del día actual.
2. THE Sistema SHALL exponer el endpoint `GET /api/bff/liquidaciones` accesible para roles `ADMIN` y `AUX`.
3. WHEN el BffLiquidacionesUseCase se invoca, THE Sistema SHALL retornar un objeto con las claves `mensajeros`, `regla_activa`, y `pendientes_hoy`.
4. THE Sistema SHALL exponer el endpoint `GET /api/liquidations/courier/:courier_id/pending-today` que retorna los Servicios_Pendientes_Mensajero del día actual para un mensajero específico, incluyendo datos del cliente.
5. THE Sistema SHALL exponer el endpoint `GET /api/liquidations/customers/with-unpaid` que retorna los clientes con al menos un servicio con `payment_status = UNPAID`, incluyendo el conteo de servicios pendientes.
6. THE Sistema SHALL exponer el endpoint `GET /api/liquidations/customer/:customer_id/unpaid-services` que retorna los servicios con `payment_status = UNPAID` de un cliente, con soporte de filtro por `from` y `to` (fecha de entrega).

---

### Requirement 11: Fix en página de crear servicio — PaymentMethod enum

**User Story:** Como desarrollador frontend, quiero que el formulario de creación de servicios use los valores correctos del enum `PaymentMethod`, para que la creación de servicios no falle.

#### Acceptance Criteria

1. THE Sistema SHALL usar los valores `CASH`, `TRANSFER`, `CREDIT` en el selector de método de pago del formulario de creación de servicios.
2. THE Sistema SHALL mostrar las etiquetas en español: `CASH` → "Efectivo", `TRANSFER` → "Transferencia", `CREDIT` → "Crédito".
3. WHEN el usuario selecciona `CASH` o `TRANSFER`, THE Sistema SHALL enviar `payment_method: "CASH"` o `payment_method: "TRANSFER"` respectivamente al endpoint `POST /api/services`.
4. WHEN el usuario selecciona `CREDIT`, THE Sistema SHALL enviar `payment_method: "CREDIT"` al endpoint `POST /api/services`.

---

### Requirement 12: Componente reutilizable AsignarMensajeroModal

**User Story:** Como administrador, quiero un modal reutilizable para asignar mensajeros, para usarlo tanto en la creación de servicios como en la tabla de servicios.

#### Acceptance Criteria

1. THE AsignarMensajeroModal SHALL mostrar únicamente los mensajeros con `operational_status = AVAILABLE`.
2. THE AsignarMensajeroModal SHALL mostrar cada mensajero con su nombre, teléfono y estado.
3. WHEN el administrador selecciona un mensajero en el AsignarMensajeroModal, THE Sistema SHALL invocar el callback `onSelect(courier_id)` proporcionado por el componente padre.
4. THE Sistema SHALL usar el AsignarMensajeroModal tanto en la página de creación de servicios (botón "Asignar Mensajero", no obligatorio) como en la tabla de servicios (acción de asignación).
5. WHEN el administrador hace clic en "Asignar Mensajero" en la página de creación de servicios, THE Sistema SHALL abrir el AsignarMensajeroModal y, al seleccionar un mensajero, asignarlo al servicio que se está creando.
6. THE AsignarMensajeroModal SHALL ser un componente independiente ubicado en `src/features/servicios/components/AsignarMensajeroModal.tsx` para ser importado desde múltiples contextos.

---

### Requirement 13: Generación de comprobante de liquidación

**User Story:** Como administrador, quiero generar un comprobante de liquidación, para tener un registro imprimible o descargable del pago al mensajero.

#### Acceptance Criteria

1. WHEN el administrador hace clic en "Generar Comprobante" tras una liquidación exitosa, THE Sistema SHALL generar un documento con: nombre del mensajero, fecha, lista de servicios incluidos, total recaudado, comisión aplicada, y total a pagar.
2. THE Sistema SHALL permitir al administrador imprimir o descargar el comprobante en formato PDF o como vista imprimible del navegador.

---

### Requirement 14: Parser y serialización de datos de liquidación (round-trip)

**User Story:** Como desarrollador, quiero que los datos de liquidación se serialicen y deserialicen correctamente entre el backend y el frontend, para evitar errores de tipo en los cálculos financieros.

#### Acceptance Criteria

1. THE Sistema SHALL serializar los campos `delivery_price`, `total_earned`, y `total_invoiced` como números con dos decimales en todas las respuestas de la API de liquidaciones.
2. THE Sistema SHALL deserializar correctamente los valores `Decimal` de Prisma a `number` de JavaScript antes de retornarlos al frontend.
3. FOR ALL valores `Decimal` de Prisma en liquidaciones, serializar a JSON y luego parsear de JSON SHALL producir un valor numérico equivalente (propiedad round-trip).
4. THE Sistema SHALL retornar `total_earned` y `total_invoiced` como `number` (no como `string` ni `Decimal`) en todas las respuestas de liquidación.
