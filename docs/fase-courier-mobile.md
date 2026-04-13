# Módulo Courier Mobile

## Objetivo

API dedicada para la app móvil del mensajero. Concentra todas las operaciones que un `COURIER` necesita: consultar su perfil, gestionar su jornada, actualizar estados de servicios, subir evidencias y reportar su ubicación.

Todos los endpoints requieren JWT con rol `COURIER`. El `company_id` y el `courier_id` se resuelven automáticamente desde el token — el mensajero nunca necesita enviarlos.

## Endpoints

Base: `/api/courier` · Requiere JWT con rol `COURIER`

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/courier/me` | Mi perfil de mensajero |
| POST | `/api/courier/jornada/start` | Iniciar jornada (UNAVAILABLE → AVAILABLE) |
| POST | `/api/courier/jornada/end` | Finalizar jornada (AVAILABLE → UNAVAILABLE) |
| GET | `/api/courier/services` | Mis servicios asignados |
| POST | `/api/courier/services/:id/status` | Cambiar estado de un servicio |
| POST | `/api/courier/services/:id/evidence` | Subir evidencia de entrega |
| POST | `/api/courier/location` | Registrar ubicación actual |
| GET | `/api/courier/settlements` | Mis liquidaciones |
| GET | `/api/courier/settlements/earnings` | Resumen de mis ganancias |
| GET | `/api/courier/settlements/:id` | Detalle de una liquidación |

---

## Detalle de endpoints

### GET /api/courier/me
Retorna el perfil completo del mensajero autenticado, incluyendo estado operacional.

---

### POST /api/courier/jornada/start
Inicia la jornada. Solo posible desde estado `UNAVAILABLE`.

**Respuesta 200:** Perfil actualizado con `operational_status: AVAILABLE`

**Error 400:** Estado actual no permite iniciar jornada

---

### POST /api/courier/jornada/end
Finaliza la jornada. Solo posible desde estado `AVAILABLE` y sin servicios activos.

**Respuesta 200:** Perfil actualizado con `operational_status: UNAVAILABLE`

**Error 400:** Hay servicios activos (ASSIGNED, ACCEPTED o IN_TRANSIT) o estado inválido

---

### GET /api/courier/services
Lista todos los servicios asignados al mensajero autenticado, ordenados por fecha de creación descendente.

---

### POST /api/courier/services/:id/status
Cambia el estado de un servicio.

**Transiciones válidas:**
```
ASSIGNED   → ACCEPTED
ACCEPTED   → IN_TRANSIT
IN_TRANSIT → DELIVERED  (requiere evidencia previa)
```

**Body:**
```json
{ "status": "ACCEPTED" }
```

**Error 400:** Transición inválida o falta evidencia para DELIVERED

---

### POST /api/courier/services/:id/evidence
Sube la evidencia fotográfica de entrega. Solo cuando el servicio está en `IN_TRANSIT`. Re-subir reemplaza la evidencia existente.

**Body:**
```json
{ "image_url": "https://storage.ejemplo.com/foto.jpg" }
```

---

### POST /api/courier/location
Registra la ubicación actual del mensajero. Solo cuando está en estado `IN_SERVICE`.

**Body:**
```json
{
  "latitude": 4.710989,
  "longitude": -74.072092,
  "accuracy": 10.5
}
```

Frecuencia recomendada: cada 15 segundos.

---

### GET /api/courier/settlements
Lista todas las liquidaciones generadas para el mensajero autenticado. El `courier_id` se resuelve desde el token — no se envía en la request.

**Respuesta 200:**
```json
[
  {
    "id": "uuid",
    "start_date": "2025-01-01T00:00:00.000Z",
    "end_date": "2025-01-31T00:00:00.000Z",
    "total_services": 42,
    "total_earned": 315000,
    "created_at": "2025-02-01T10:00:00.000Z"
  }
]
```

---

### GET /api/courier/settlements/earnings
Resumen acumulado de ganancias del mensajero autenticado.

**Respuesta 200:**
```json
{
  "total_settlements": 3,
  "total_services": 120,
  "total_earned": 900000,
  "settlements": [ ... ]
}
```

---

### GET /api/courier/settlements/:id
Detalle completo de una liquidación específica.

**Error 404:** Liquidación no encontrada o no pertenece a la empresa.

---

## Flujo típico en la app móvil

```
1. POST /api/auth/login              → autenticarse
2. GET  /api/courier/me              → ver perfil y estado actual
3. POST /api/courier/jornada/start   → iniciar jornada
4. GET  /api/courier/services        → ver servicios asignados
5. POST /api/courier/services/:id/status  { "status": "ACCEPTED" }
6. POST /api/courier/services/:id/status  { "status": "IN_TRANSIT" }
7. POST /api/courier/location        → reportar ubicación (loop cada 15s)
8. POST /api/courier/services/:id/evidence  { "image_url": "..." }
9. POST /api/courier/services/:id/status  { "status": "DELIVERED" }
10. POST /api/courier/jornada/end    → finalizar jornada

── Sección de ganancias ──
11. GET /api/courier/settlements/earnings  → resumen de ganancias
12. GET /api/courier/settlements           → historial de liquidaciones
13. GET /api/courier/settlements/:id       → detalle de una liquidación
```

## Archivos

| Archivo | Descripción |
|---------|-------------|
| `src/modules/courier-mobile/courier-mobile.controller.ts` | Controlador HTTP |
| `src/modules/courier-mobile/courier-mobile.module.ts` | Módulo NestJS |

## Dependencias de módulos

El módulo no duplica lógica — reutiliza use cases exportados de:
- `MensajerosModule` — `ConsultarMensajerosUseCase`, `JornadaUseCase`
- `ServiciosModule` — `CambiarEstadoUseCase` y repositorios
- `EvidenciasModule` — `SubirEvidenciaUseCase`
- `TrackingModule` — `RegistrarUbicacionUseCase`
- `LiquidacionesModule` — `ConsultarLiquidacionesUseCase`
