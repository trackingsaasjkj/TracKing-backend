# Guía Mobile — Liquidaciones y Ganancias del Mensajero

Esta guía explica cómo integrar la sección de liquidaciones y resumen de ganancias en la app del mensajero.

---

## Autenticación

Todos los endpoints requieren el header:

```
Authorization: Bearer <access_token>
```

El token se obtiene en `POST /api/auth/login`. El `courier_id` y `company_id` se resuelven automáticamente desde el token — no se envían en ninguna request.

---

## Endpoints disponibles

Base URL: `/api/courier`

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/courier/settlements` | Historial de liquidaciones |
| GET | `/api/courier/settlements/earnings` | Resumen acumulado de ganancias |
| GET | `/api/courier/settlements/:id` | Detalle de una liquidación |

---

## 1. Resumen de ganancias

Ideal para mostrar en el dashboard principal o en una pantalla de "Mis Ganancias".

```
GET /api/courier/settlements/earnings
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "data": {
    "total_settlements": 3,
    "total_services": 120,
    "total_earned": 900000,
    "settlements": [
      {
        "id": "uuid",
        "start_date": "2025-01-01T00:00:00.000Z",
        "end_date": "2025-01-31T00:00:00.000Z",
        "total_services": 42,
        "total_earned": 315000,
        "created_at": "2025-02-01T10:00:00.000Z"
      }
    ]
  }
}
```

**Campos clave:**
- `total_earned` — ganancias totales acumuladas (en la moneda configurada por la empresa)
- `total_services` — total de servicios entregados en todas las liquidaciones
- `total_settlements` — número de liquidaciones generadas
- `settlements` — array con el detalle de cada liquidación

---

## 2. Historial de liquidaciones

Lista todas las liquidaciones del mensajero, ordenadas por fecha de creación.

```
GET /api/courier/settlements
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "start_date": "2025-01-01T00:00:00.000Z",
      "end_date": "2025-01-31T00:00:00.000Z",
      "total_services": 42,
      "total_earned": 315000,
      "created_at": "2025-02-01T10:00:00.000Z"
    }
  ]
}
```

---

## 3. Detalle de una liquidación

Muestra el detalle completo de una liquidación específica.

```
GET /api/courier/settlements/:id
```

**Parámetro:** `id` — UUID de la liquidación (obtenido del listado anterior)

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "start_date": "2025-01-01T00:00:00.000Z",
    "end_date": "2025-01-31T00:00:00.000Z",
    "total_services": 42,
    "total_earned": 315000,
    "created_at": "2025-02-01T10:00:00.000Z"
  }
}
```

**Error 404:** La liquidación no existe o no pertenece a la empresa del mensajero.

---

## Flujo recomendado en la app

```
Pantalla "Mis Ganancias"
  └── GET /api/courier/settlements/earnings
        → Mostrar total_earned, total_services, total_settlements
        → Renderizar lista de settlements con fecha y monto

Al tocar una liquidación
  └── GET /api/courier/settlements/:id
        → Mostrar detalle completo
```

---

## Notas importantes

- Las liquidaciones son generadas por el administrador de la empresa, no por el mensajero. El mensajero solo puede consultarlas.
- Un servicio aparece en una liquidación solo cuando está en estado `DELIVERED`.
- Si el array `settlements` está vacío, significa que aún no se ha generado ninguna liquidación para ese mensajero.
- El campo `total_earned` refleja el cálculo según la regla de liquidación activa de la empresa (puede ser porcentaje sobre el precio del servicio o monto fijo por servicio).
