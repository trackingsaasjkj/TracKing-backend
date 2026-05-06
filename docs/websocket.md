# WebSocket — Tiempo Real

Documentación de los 3 gateways Socket.IO del backend y su integración con la app móvil.

## Gateways disponibles

| Namespace | Roles permitidos | Eventos emitidos |
|-----------|-----------------|-----------------|
| `/services` | `COURIER` | `service:updated`, `service:assigned`, `settlement:created` |
| `/dashboard` | `ADMIN`, `AUX` | `service:updated`, `dashboard:refresh` |
| `/tracking` | `ADMIN`, `AUX` | `location:updated` |

---

## Autenticación

Todos los gateways validan el JWT en `handleConnection`. El cliente puede enviarlo de tres formas (en orden de prioridad):

```js
// 1. handshake.auth (recomendado para socket.io-client)
const socket = io('/services', { auth: { token: 'eyJ...' } });

// 2. query param (usado por el cliente nativo de React Native)
const url = 'wss://host/services/?EIO=4&transport=websocket&token=eyJ...';

// 3. header Authorization
const socket = io('/services', { extraHeaders: { authorization: 'Bearer eyJ...' } });
```

El cliente es desconectado inmediatamente si:
- No hay token
- El token es inválido o expirado
- El rol no coincide con el permitido en ese namespace

---

## Namespace `/services`

Actualizaciones de servicios para mensajeros (couriers).

### Conexión

```js
const socket = io('https://host/services', {
  auth: { token: accessToken }
});
```

El courier se une automáticamente a la sala `courier:{courierId}` al conectarse.

### Eventos recibidos por el cliente

| Evento | Cuándo | Payload |
|--------|--------|---------|
| `connection:ack` | Al conectar | `{ courierId, timestamp }` |
| `service:updated` | Estado del servicio cambia | Objeto `Service` completo |
| `service:assigned` | Nuevo servicio asignado al courier | Objeto `Service` completo |
| `settlement:created` | Nueva liquidación generada | Objeto `Settlement` |

### Quién emite cada evento

| Evento | Use case | Cuándo |
|--------|----------|--------|
| `service:updated` | `CambiarEstadoUseCase` | Al cambiar estado de un servicio |
| `service:assigned` | `AsignarServicioUseCase` | Al asignar o reasignar un servicio |
| `settlement:created` | `GenerarLiquidacionCourierUseCase` | Al generar una liquidación |

### Métodos del gateway

```typescript
emitServiceUpdate(courierId: string, service: Record<string, unknown>): void
emitServiceAssigned(courierId: string, service: Record<string, unknown>): void
emitSettlementCreated(courierId: string, settlement: Record<string, unknown>): void
```

---

## Namespace `/dashboard`

Actualizaciones en tiempo real para el panel de administración web.

### Conexión

```js
const socket = io('https://host/dashboard', {
  auth: { token: accessToken }
});
```

El cliente se une a la sala `company:{companyId}` al conectarse.

### Eventos recibidos por el cliente

| Evento | Cuándo | Payload |
|--------|--------|---------|
| `connection:ack` | Al conectar | `{ timestamp }` |
| `service:updated` | Estado de un servicio cambia | Objeto `Service` completo |
| `dashboard:refresh` | Métricas del dashboard cambian | (vacío) |

### Quién emite cada evento

| Evento | Use case | Cuándo |
|--------|----------|--------|
| `service:updated` | `CambiarEstadoUseCase`, `AsignarServicioUseCase` | Al cambiar estado o asignar |
| `dashboard:refresh` | `CambiarEstadoUseCase`, `AsignarServicioUseCase` | Ídem |

---

## Namespace `/tracking`

Geolocalización en tiempo real para el mapa de administración.

### Conexión

```js
const socket = io('https://host/tracking', {
  auth: { token: accessToken }
});
```

El cliente se une a la sala `{companyId}` al conectarse.

### Eventos recibidos por el cliente

| Evento | Cuándo | Payload |
|--------|--------|---------|
| `location:updated` | Courier envía su ubicación | `{ courier_id, latitude, longitude, accuracy?, timestamp }` |

### Quién emite

`RegistrarUbicacionUseCase` → después de guardar la ubicación en DB.

---

## Integración en React Native (TracKing Mobile)

El cliente nativo (`wsClient.ts`) conecta únicamente al namespace `/services` usando Engine.IO v4 sin dependencias externas.

### Flujo de conexión

```
1. wsClient.connect(token)
2. WebSocket abre a wss://host/services/?EIO=4&transport=websocket&token=<JWT>
3. Servidor envía EIO "0" (open)
4. Cliente envía SIO connect packet con { token } en el payload
5. Servidor valida JWT → une al courier a su sala
6. Servidor emite connection:ack
7. Cliente emite 'connected' en statusListeners
```

### Reconexión automática

Backoff exponencial: 1s → 2s → 4s → 8s → 16s → 30s (máximo 6 intentos).

### Ping/pong

El cliente envía un ping Engine.IO cada 25s para mantener la conexión viva en Render (timeout TCP de 60s).

### Hooks disponibles

| Hook | Descripción |
|------|-------------|
| `useServiceUpdates()` | Conecta WS + FCM al store de servicios. Montar una vez en `useServices()`. |
| `useDashboardUpdates(onRefresh)` | Escucha `service:assigned` → llama `onRefresh()` para actualizar KPIs. |
| `useEarningsUpdates()` | Escucha `settlement:created` → invalida cache `['courier-earnings']`. |
| `useWsStatus()` | Retorna el estado de conexión: `connected \| reconnecting \| disconnected`. |

### Capas de actualización (por prioridad)

```
1. WebSocket (< 50ms)   — app en foreground, conexión activa
2. FCM Push             — app en background o killed
3. Polling (cada 45s)   — fallback cuando WS no disponible
```

---

## Bugs corregidos (Mayo 2026)

### Bug 1 — `AsignarServicioUseCase` no emitía WS

`AsignarServicioUseCase` solo enviaba FCM al asignar un servicio. El courier en foreground dependía del polling (hasta 45s de delay) para ver el nuevo servicio.

**Fix:** Se inyectaron `ServiceUpdatesGateway` y `DashboardUpdatesGateway` con `@Optional()`. Ahora emite `service:assigned` al courier y `service:updated` + `dashboard:refresh` al panel de admin.

### Bug 2 — `settlement:created` nunca se emitía

`useEarningsUpdates` en mobile escuchaba `settlement:created`, pero el backend nunca lo emitía. Tres cambios necesarios:

- Se agregó `emitSettlementCreated()` a `ServiceUpdatesGateway`
- Se importó `ServiciosModule` en `LiquidacionesModule`
- Se inyectó el gateway en `GenerarLiquidacionCourierUseCase` con `@Optional()`

### Bug 3 — Token en query param no se leía

El cliente nativo envía el JWT como `?token=<JWT>` en la URL del WebSocket, pero los tres gateways solo leían `handshake.auth.token` y `headers.authorization`.

**Fix:** Se agregó `handshake.query?.token` como segundo fallback en los tres gateways (`/services`, `/tracking`, `/dashboard`).

---

## Archivos relevantes

### Backend

| Archivo | Descripción |
|---------|-------------|
| `src/modules/servicios/services-updates.gateway.ts` | Gateway `/services` — couriers |
| `src/modules/servicios/dashboard-updates.gateway.ts` | Gateway `/dashboard` — admin/aux |
| `src/modules/tracking/tracking.gateway.ts` | Gateway `/tracking` — geolocalización |
| `src/modules/servicios/application/use-cases/asignar-servicio.use-case.ts` | Emite `service:assigned` + dashboard events |
| `src/modules/servicios/application/use-cases/cambiar-estado.use-case.ts` | Emite `service:updated` + dashboard events |
| `src/modules/liquidaciones/application/use-cases/generar-liquidacion-courier.use-case.ts` | Emite `settlement:created` |
| `src/modules/liquidaciones/liquidaciones.module.ts` | Importa `ServiciosModule` para acceder al gateway |
| `specs/websocket-fixes.spec.ts` | Tests de los 3 bugs corregidos |

### Mobile

| Archivo | Descripción |
|---------|-------------|
| `src/core/api/wsClient.ts` | Cliente WebSocket nativo (singleton) |
| `src/core/hooks/useWsStatus.ts` | Hook de estado de conexión |
| `src/features/services/hooks/useServiceUpdates.ts` | WS + FCM → servicesStore |
| `src/features/dashboard/hooks/useDashboardUpdates.ts` | `service:assigned` → refresh KPIs |
| `src/features/earnings/hooks/useEarningsUpdates.ts` | `settlement:created` → invalida cache |
