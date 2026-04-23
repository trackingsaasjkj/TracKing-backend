# Fase — Notificaciones Push (FCM)

Módulo de notificaciones push para la app móvil de mensajeros usando Firebase Cloud Messaging (FCM) directamente, sin intermediarios.

## Objetivo

Enviar notificaciones push en tiempo real a los mensajeros cuando:
- Se les asigna un nuevo servicio
- Un servicio es actualizado o cancelado
- Su liquidación está lista para revisar

## Arquitectura

```
Backend NestJS
  └── NotificationsModule
        ├── FirebaseService       → Admin SDK, envío a FCM
        ├── NotificationsRepository → guarda/lee fcm_token en Courier
        └── NotificationsUseCases → lógica + helpers para otros módulos

App Móvil (Expo)
  └── @react-native-firebase/messaging
        ├── fcm.service.ts        → funciones puras de FCM
        └── useFCM.ts             → hook que inicializa todo al autenticarse
```

## Endpoints

Base: `/api/notifications` · Requiere JWT

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `POST` | `/api/notifications/fcm-token` | `COURIER` | Registra o actualiza el FCM token del mensajero |
| `DELETE` | `/api/notifications/fcm-token` | `COURIER` | Elimina el FCM token (logout) |
| `POST` | `/api/notifications/send` | `ADMIN`, `AUX` | Envía notificación a un mensajero específico |

### POST /api/notifications/fcm-token

El mensajero registra su token FCM al iniciar sesión en la app móvil. Se llama automáticamente desde el hook `useFCM`.

**Body:**
```json
{ "token": "dGhpcyBpcyBhIHNhbXBsZSBGQ00gdG9rZW4..." }
```

**Respuesta 200:**
```json
{ "success": true, "data": { "message": "FCM token registrado" } }
```

---

### DELETE /api/notifications/fcm-token

Elimina el token al hacer logout para que el mensajero no reciba notificaciones en dispositivos donde cerró sesión.

**Respuesta 200:**
```json
{ "success": true, "data": { "message": "FCM token eliminado" } }
```

---

### POST /api/notifications/send

Envía una notificación push a un mensajero específico de la empresa.

**Body:**
```json
{
  "courierId": "uuid-mensajero",
  "title": "📦 Nuevo servicio asignado",
  "body": "Tienes un nuevo servicio en Calle 10 #5-20",
  "type": "new_service",
  "data": { "serviceId": "uuid-servicio" }
}
```

**Tipos de notificación (`type`):**
| Valor | Descripción |
|-------|-------------|
| `new_service` | Nuevo servicio asignado al mensajero |
| `service_update` | Actualización de estado de un servicio |
| `settlement_ready` | Liquidación disponible para revisar |
| `general` | Notificación general |

**Respuesta 201:**
```json
{ "success": true, "data": { "sent": true } }
```

> `sent: false` cuando el mensajero no tiene token FCM registrado (no ha iniciado sesión en la app móvil).

---

## Cambio en schema Prisma

Se agregó el campo `fcm_token` al modelo `Courier`:

```prisma
model Courier {
  // ...campos existentes
  fcm_token  String?  @db.VarChar(255)
}
```

Migración: `20260421000000_add_fcm_token_to_courier`

---

## Variables de entorno requeridas

```env
FIREBASE_PROJECT_ID=tracking-8cc04
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@tracking-8cc04.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

> Si las variables no están configuradas, el módulo arranca en modo degradado (warn en logs) y las notificaciones se omiten silenciosamente sin romper el servidor.

---

## Uso desde otros módulos

`NotificationsUseCases` se exporta desde `NotificationsModule` para que otros módulos puedan enviar notificaciones sin acoplarse a Firebase directamente.

```typescript
// En ServiciosModule, al asignar un servicio:
constructor(private readonly notifications: NotificationsUseCases) {}

await this.notifications.notifyNewService(courierId, serviceId, companyId);
```

**Helpers disponibles:**

| Método | Cuándo usarlo |
|--------|---------------|
| `notifyNewService(courierId, serviceId, companyId)` | Al asignar un servicio a un mensajero |
| `notifyServiceUpdate(courierId, serviceId, companyId, message)` | Al cancelar o actualizar un servicio |
| `notifySettlementReady(courierId, companyId)` | Al generar una liquidación |
| `sendToCourier(dto, companyId)` | Notificación personalizada a un mensajero |
| `sendToAllCouriers(companyId, title, body, data?)` | Broadcast a todos los mensajeros activos |

---

## Flujo completo

```
1. Mensajero abre la app móvil
2. useFCM hook solicita permiso de notificaciones
3. Obtiene FCM token del dispositivo
4. POST /api/notifications/fcm-token → token guardado en BD

5. Admin asigna servicio → backend llama notifyNewService()
6. FirebaseService.sendToDevice() → FCM → dispositivo Android
7. App recibe notificación (foreground/background/killed)
8. handleNotificationNavigation() navega a la pantalla correcta

9. Mensajero hace logout → DELETE /api/notifications/fcm-token
```

---

## Archivos relevantes

| Archivo | Descripción |
|---------|-------------|
| `src/modules/notifications/notifications.module.ts` | Módulo NestJS |
| `src/modules/notifications/notifications.controller.ts` | Endpoints REST |
| `src/modules/notifications/application/use-cases/notifications.use-cases.ts` | Lógica de negocio |
| `src/modules/notifications/application/dto/register-token.dto.ts` | DTO registro token |
| `src/modules/notifications/application/dto/send-notification.dto.ts` | DTO envío |
| `src/modules/notifications/infrastructure/firebase.service.ts` | Admin SDK wrapper |
| `src/modules/notifications/infrastructure/notifications.repository.ts` | Acceso a BD |
| `prisma/migrations/20260421000000_add_fcm_token_to_courier/` | Migración |
| `specs/notifications.spec.ts` | Tests unitarios (12 tests) |
