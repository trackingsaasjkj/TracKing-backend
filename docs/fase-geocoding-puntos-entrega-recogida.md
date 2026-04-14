# FASE — Geocoding y Puntos de Entrega/Recogida

## Objetivo

Implementar un proxy de geocoding hacia la API de Mapbox que convierte direcciones de texto en coordenadas geográficas, persiste esas coordenadas en el modelo `Service`, y expone los campos necesarios para que el panel web y la app móvil visualicen los puntos de recogida y entrega en un mapa.

---

## Entidades involucradas

- `service` (tabla DB) — se añaden 6 nuevos campos
- `GeocodingModule` — módulo nuevo

---

## Migración de base de datos

Se añadieron 6 campos al modelo `Service` en `prisma/schema.prisma`:

```prisma
origin_lat           Decimal?  @db.Decimal(9, 6)
origin_lng           Decimal?  @db.Decimal(9, 6)
origin_verified      Boolean   @default(false)
destination_lat      Decimal?  @db.Decimal(9, 6)
destination_lng      Decimal?  @db.Decimal(9, 6)
destination_verified Boolean   @default(false)
```

- Todos los campos son opcionales para mantener compatibilidad con servicios existentes.
- Los booleanos tienen `@default(false)`.
- Precisión `Decimal(9,6)` equivale a ~11 cm de precisión geográfica.
- Migración aplicada: `20260413000000_add_geocoding_fields_to_service`

---

## Módulo Geocoding

### Estructura de archivos

```
src/modules/geocoding/
├── application/
│   └── dto/
│       └── forward-geocoding.dto.ts
├── geocoding.controller.ts
├── geocoding.service.ts
└── geocoding.module.ts
```

### Endpoint

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| POST | `/api/geocoding/forward` | ADMIN, AUX | Convierte dirección de texto en coordenadas |

**Request body:**
```json
{ "address": "Calle 10 #20-30, Bucaramanga" }
```

**Response:**
```json
{
  "success": true,
  "data": {
    "latitude": 7.119349,
    "longitude": -73.122742,
    "display_name": "Calle 10, Bucaramanga, Colombia"
  }
}
```

**Errores:**

| Escenario | Código |
|-----------|--------|
| Mapbox no encuentra la dirección | 404 |
| Error o timeout de Mapbox | 502 |
| Dirección vacía | 400 |
| Token no configurado | 502 |

### Caché

- Clave: `geocoding:${normalizedAddress}` (trim + lowercase)
- TTL: 86400 segundos (24 horas)
- Implementado sobre `CacheService` existente
- Variantes de la misma dirección (mayúsculas, espacios extra) comparten caché

### Log de monitoreo

Cada llamada efectiva a Mapbox (cache miss) registra:
```
[GeocodingService] Mapbox call | company: {company_id} | address: {normalized}
```

### Variable de entorno

```env
MAPBOX_ACCESS_TOKEN=pk.eyJ1IjoiXXXX...
```

Obtener en: https://account.mapbox.com/access-tokens

---

## Modificaciones al módulo Servicios

### `CrearServicioDto`

Se añadieron 6 campos opcionales con validaciones de rango:

```typescript
origin_lat?:          number  // @Min(-90)  @Max(90)
origin_lng?:          number  // @Min(-180) @Max(180)
origin_verified?:     boolean
destination_lat?:     number  // @Min(-90)  @Max(90)
destination_lng?:     number  // @Min(-180) @Max(180)
destination_verified?: boolean
```

### `CrearServicioUseCase`

El spread `...serviceData` en `tx.service.create` incluye automáticamente los nuevos campos del DTO. No se requirió lógica adicional.

### Respuesta de servicios

Todos los endpoints GET (`/api/services`, `/api/services/:id`) retornan los 6 nuevos campos.

---

## Correcciones realizadas

### Bug: creación doble de servicios

**Causa:** `useMutation` tenía un `onSuccess` que navegaba inmediatamente, y `.mutate()` tenía un segundo `onSuccess` para asignar mensajero. Ambos se ejecutaban, y sin guard de doble submit el usuario podía disparar dos peticiones.

**Solución:**
- Se eliminó el `onSuccess` del `useMutation` y se consolidó toda la lógica en el `onSuccess` del `.mutate()`.
- Se añadió guard al inicio de `handleMapConfirm`: si `createMutation.isPending` es `true`, retorna inmediatamente.
- El botón "Confirmar y continuar" se deshabilita mientras `submitting=true`.

---

## Notas de implementación

- El módulo usa `fetch` nativo con `AbortSignal.timeout(10_000)` para el timeout de Mapbox.
- `GeocodingModule` está registrado en `AppModule`.
- Los tests unitarios y de propiedades (fast-check) están en `specs/geocoding.spec.ts`.
- Sin `MAPBOX_ACCESS_TOKEN` el servicio arranca pero retorna 502 en cada llamada — no rompe el resto de la app.
