# Especificación Técnica — Integración Google Places API

**Proyecto:** TracKing  
**Fecha:** Mayo 2026  
**Estado:** ✅ Implementado y en producción  

---

## 1. Contexto y objetivo

El sistema necesita búsqueda y geocodificación de direcciones para crear servicios de mensajería. El operador (ADMIN/AUX) escribe una dirección de origen y una de destino en el formulario de creación de servicio. El sistema debe:

1. Sugerir direcciones mientras el usuario escribe (autocomplete).
2. Obtener las coordenadas exactas (lat/lng) de la dirección seleccionada.
3. Minimizar el costo de la API de Google Places.

---

## 2. Arquitectura general

```
Frontend (React)
  └── searchBoxApi.ts          ← cliente HTTP
        ↓ POST /api/search/forward
Backend (NestJS)
  └── SearchController
        └── SearchService       ← selecciona proveedor por env var
              └── GooglePlacesService
                    ├── Redis / CacheService   ← capa 1: cache en memoria
                    ├── GooglePlacesCacheService (BD) ← capa 2: cache persistente
                    ├── RateLimitService       ← protección de abuso
                    └── UserAddressHistoryService ← historial por usuario
                          ↓ (solo si no hay cache)
                    Google Places API (New)
```

El proveedor de búsqueda es intercambiable mediante la variable de entorno `SEARCH_PROVIDER=google|mapbox`. Actualmente se usa Google.

---

## 3. APIs de Google utilizadas

| API | Endpoint | Uso |
|---|---|---|
| Places Autocomplete (New) | `POST /v1/places:autocomplete` | Sugerencias mientras el usuario escribe |
| Place Details (New) | `GET /v1/places/{placeId}` | Coordenadas exactas al seleccionar una sugerencia |
| Geocoding (reverse) | `GET /maps/api/geocode/json` | Convertir coordenadas a dirección (uso opcional) |

La API key se configura en el backend vía `GOOGLE_MAPS_API_KEY`. El frontend nunca tiene acceso directo a la key.

---

## 4. Optimizaciones implementadas

Se implementaron 10 optimizaciones para reducir el consumo de la API entre un 80–90%.

### 4.1 Debounce (Frontend)

**Archivo:** `TracKing-frontend/src/features/servicios/hooks/useDebounce.ts`

Espera 500 ms después de que el usuario deja de escribir antes de disparar la búsqueda. Evita un request por cada tecla presionada.

```typescript
export function useDebounce<T>(value: T, delayMs: number = 500): T
```

**Reducción estimada:** 40–80% de requests.

---

### 4.2 Mínimo de caracteres (Backend)

**Archivo:** `google-places.service.ts`

No se consulta Google si la query tiene menos de 3 caracteres.

```typescript
const MIN_QUERY_LENGTH = 3;
if (normalized.length < MIN_QUERY_LENGTH) return [];
```

**Reducción estimada:** 20–30% de requests.

---

### 4.3 Session Tokens (Frontend + Backend)

**Archivos:**
- `TracKing-frontend/src/features/servicios/hooks/useSearchSession.ts`
- `TracKing-backend/src/modules/search/providers/session/search-session.service.ts`
- `TracKing-backend/src/modules/search/search.controller.ts` — endpoints `POST /session/create` y `POST /session/end`

Google cobra Autocomplete y Place Details como una sola unidad de sesión si se usa el mismo `sessionToken`. Sin session tokens, cada llamada se cobra por separado.

Flujo:
1. El frontend llama `POST /api/search/session/create` al abrir el formulario.
2. El `sessionToken` se adjunta a cada request de autocomplete.
3. Al seleccionar una dirección, el mismo token se usa en Place Details.
4. El frontend llama `POST /api/search/session/end` al cerrar el formulario.

Las sesiones expiran automáticamente a los 10 minutos en el backend.

**Impacto:** Reduce el costo de Place Details cuando se usa dentro de la misma sesión de autocomplete.

---

### 4.4 Cancelación de requests anteriores (Frontend)

**Archivo:** `TracKing-frontend/src/features/servicios/api/searchBoxApi.ts`

Usa `AbortController` para cancelar el request anterior si el usuario sigue escribiendo antes de que llegue la respuesta.

```typescript
let searchAbortController: AbortController | null = null

if (searchAbortController) searchAbortController.abort()
searchAbortController = new AbortController()
```

**Reducción estimada:** 10–15% de requests (evita respuestas desordenadas y procesamiento innecesario).

---

### 4.5 Cache en memoria — Redis / CacheService (Backend)

**Archivo:** `TracKing-backend/src/infrastructure/cache/cache.service.ts`

Primer nivel de cache. TTL de 1 hora. Si la misma query ya fue buscada recientemente, se devuelve el resultado sin llamar a Google.

```typescript
const cacheKey = `search:google:${normalized}:${city}`;
const cached = await this.cache.get<SearchBoxSuggestion[]>(cacheKey);
if (cached) return cached;
```

Si Redis está configurado (`REDIS_URL`), el cache es compartido entre instancias del servidor. Si no, usa cache en memoria local.

**Reducción estimada:** 15–25% de requests.

---

### 4.6 Cache persistente en base de datos (Backend)

**Archivo:** `TracKing-backend/src/modules/search/providers/google-places/google-places-cache.service.ts`  
**Tabla:** `google_places_cache`

Segundo nivel de cache. Guarda los resultados de autocomplete y Place Details en PostgreSQL (Supabase). Persiste entre reinicios del servidor.

```prisma
model GooglePlacesCache {
  company_id       String
  normalized_query String
  place_id         String
  address          String
  lat              Decimal
  lng              Decimal
  main_text        String?
  secondary_text   String?
  created_at       DateTime
  updated_at       DateTime
  @@unique([company_id, normalized_query, place_id])
}
```

Limpieza automática de entradas con más de 30 días.

**Reducción estimada:** 30–70% de requests (especialmente efectivo en SaaS multi-empresa donde múltiples usuarios buscan las mismas zonas).

---

### 4.7 Cache de Place Details en localStorage (Frontend)

**Archivo:** `TracKing-frontend/src/features/servicios/api/searchBoxApi.ts`

Cuando se obtienen las coordenadas de un `placeId` vía Place Details, el resultado se guarda en `localStorage`. Si el mismo `placeId` se necesita de nuevo (mismo navegador), no se hace ninguna llamada.

```typescript
const cacheKey = `place_details_${placeId}`
const cached = localStorage.getItem(cacheKey)
if (cached) return JSON.parse(cached)
```

---

### 4.8 Cache en sesión de React (Frontend)

**Archivo:** `TracKing-frontend/src/features/servicios/hooks/useGeocoding.ts`

Cache en memoria (`useRef<Map>`) durante la sesión del componente. Si el usuario escribe la misma query dos veces en el mismo formulario, el segundo intento no hace ningún request.

```typescript
const cache = useRef<Map<string, SearchBoxSuggestion[]>>(new Map())
const cached = cache.current.get(key)
if (cached) return cached
```

---

### 4.9 Historial de direcciones por usuario (Backend + Frontend)

**Archivos:**
- `TracKing-backend/src/modules/search/providers/user-address-history/user-address-history.service.ts`
- `TracKing-backend/src/modules/search/search.controller.ts` — endpoints `GET /history` y `POST /history/record`
- `TracKing-frontend/src/features/servicios/api/searchBoxApi.ts` — métodos `getHistory()` y `recordSelection()`

**Tabla:** `user_address_history`

```prisma
model UserAddressHistory {
  user_id      String
  company_id   String
  address      String
  place_id     String?
  lat          Decimal?
  lng          Decimal?
  used_count   Int       @default(1)
  last_used_at DateTime
  @@unique([user_id, company_id, address])
}
```

Cuando el usuario selecciona una dirección, se registra en su historial. La próxima vez que abra el formulario, las direcciones frecuentes aparecen como sugerencias sin consultar Google.

Limpieza automática de direcciones no usadas en más de 90 días o que excedan 100 entradas por usuario.

**Reducción estimada:** 10–20% de requests.

---

### 4.10 Rate Limiting (Backend)

**Archivos:**
- `TracKing-backend/src/infrastructure/cache/rate-limit.service.ts`
- `TracKing-backend/src/infrastructure/middleware/google-places-rate-limit.middleware.ts`

Límite de 10 búsquedas por minuto por usuario. Protege contra uso abusivo o bugs en el frontend que disparen requests en bucle. Retorna HTTP 429 con headers informativos.

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1716500460
```

---

### 4.11 Analytics de consumo (Backend)

**Archivo:** `TracKing-backend/src/modules/search/providers/google-places/google-places-analytics.service.ts`

Registra por empresa: autocomplete requests, Place Details requests, cache hits y cache misses. Permite detectar abuso (>100 requests/minuto) y medir el ahorro real del cache.

---

### 4.12 Normalización de queries (Backend)

Antes de buscar en cache o en Google, la query se normaliza:

```typescript
private normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}
```

Esto hace que `"Cra 27 #48"`, `"CRA 27 #48"` y `"cra 27 #48"` sean el mismo cache hit.

---

### 4.13 Restricción geográfica y location bias (Backend)

Todas las búsquedas incluyen:
- `regionCode: "CO"` — restringe resultados a Colombia.
- `locationBias` con radio de 50 km centrado en las coordenadas configuradas (por defecto Bucaramanga).

Configurable por empresa vía variables de entorno:
```
GOOGLE_MAPS_COUNTRY=co
GOOGLE_MAPS_PROXIMITY_LAT=7.119349
GOOGLE_MAPS_PROXIMITY_LNG=-73.122742
```

---

### 4.14 Límite de resultados (Backend)

Máximo 5 sugerencias por búsqueda (configurable). Reduce el payload de respuesta y el tiempo de render.

---

### 4.15 Fallback inteligente (Backend)

Si Google Places falla (timeout, error 5xx), el sistema intenta devolver resultados del cache de BD antes de lanzar un error al cliente. El servicio permanece disponible aunque Google esté caído.

---

## 5. Flujo completo por campo de dirección

```
1. Usuario abre formulario
   └── Frontend: POST /api/search/session/create → sessionToken

2. Usuario escribe "Cra 27"
   └── Frontend: debounce 500ms → espera

3. Usuario escribe "Cra 27 #48"
   └── Frontend: debounce 500ms → dispara búsqueda
   └── Backend: normaliza → "cra 27 #48"
   └── Backend: verifica rate limit → OK
   └── Backend: busca en Redis → miss
   └── Backend: busca en BD cache → miss
   └── Backend: llama Google Autocomplete con sessionToken
   └── Backend: guarda en Redis (TTL 1h) y en BD
   └── Frontend: muestra 5 sugerencias

4. Usuario selecciona "Carrera 27 #48-30, Bucaramanga"
   └── Frontend: POST /api/search/details (placeId)
   └── Backend: busca en Redis → miss
   └── Backend: llama Google Place Details con mismo sessionToken
   └── Backend: guarda en Redis y BD
   └── Frontend: guarda en localStorage
   └── Frontend: POST /api/search/history/record (fire-and-forget)
   └── Formulario: lat/lng asignados al campo

5. Usuario cierra formulario
   └── Frontend: POST /api/search/session/end
```

---

## 6. Endpoints del backend

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| `POST` | `/api/search/session/create` | ADMIN, AUX | Crea session token |
| `POST` | `/api/search/session/end` | ADMIN, AUX | Finaliza session token |
| `POST` | `/api/search/forward` | ADMIN, AUX | Autocomplete de direcciones |
| `POST` | `/api/search/reverse` | ADMIN, AUX | Coordenadas → dirección |
| `POST` | `/api/search/details` | ADMIN, AUX | Place Details por placeId |
| `GET` | `/api/search/history` | ADMIN, AUX | Historial de direcciones del usuario |
| `POST` | `/api/search/history/record` | ADMIN, AUX | Registra dirección seleccionada |
| `GET` | `/api/search/global` | ADMIN, AUX | Búsqueda global (clientes, mensajeros, servicios) |

---

## 7. Variables de entorno requeridas

```env
# Proveedor activo
SEARCH_PROVIDER=google

# Google Places
GOOGLE_MAPS_API_KEY=AIzaSy...
GOOGLE_MAPS_COUNTRY=co
GOOGLE_MAPS_PROXIMITY_LAT=7.119349
GOOGLE_MAPS_PROXIMITY_LNG=-73.122742
GOOGLE_MAPS_REFERER=https://tudominio.com

# Redis (opcional — si no se configura, usa cache en memoria)
REDIS_URL=redis://...
```

---

## 8. Estimación de costos

Precios Google Places API (New) a mayo 2026:

| API | Precio / 1,000 requests |
|---|---|
| Autocomplete | $2.83 |
| Place Details | $17.00 |
| Geocoding reverse | $5.00 |

Google otorga **$200 USD de crédito gratuito mensual**.

Con las optimizaciones implementadas (tasa de cache hit estimada ~40%):

| Volumen mensual | Costo bruto estimado | Costo real (con crédito) |
|---|---|---|
| 300 servicios | ~$10 | **$0** |
| 500 servicios | ~$17 | **$0** |
| 1,000 servicios | ~$35 | **$0** |
| ~5,800 servicios | ~$200 | **$0** (límite del crédito) |
| >5,800 servicios | >$200 | **Empieza a cobrar** |

Sin las optimizaciones, el punto de quiebre estaría alrededor de los 1,000–1,500 servicios.

---

## 9. Archivos clave

### Backend

| Archivo | Responsabilidad |
|---|---|
| `src/modules/search/search.controller.ts` | Endpoints HTTP |
| `src/modules/search/search.service.ts` | Selección de proveedor |
| `src/modules/search/providers/google-places/google-places.service.ts` | Lógica principal, rate limit, cache |
| `src/modules/search/providers/google-places/google-places-cache.service.ts` | Cache en BD |
| `src/modules/search/providers/google-places/google-places-details.service.ts` | Place Details API |
| `src/modules/search/providers/google-places/google-places-analytics.service.ts` | Métricas por empresa |
| `src/modules/search/providers/session/search-session.service.ts` | Session tokens |
| `src/modules/search/providers/user-address-history/user-address-history.service.ts` | Historial de direcciones |
| `src/infrastructure/cache/rate-limit.service.ts` | Rate limiting |
| `src/infrastructure/middleware/google-places-rate-limit.middleware.ts` | Middleware HTTP |

### Frontend

| Archivo | Responsabilidad |
|---|---|
| `src/features/servicios/api/searchBoxApi.ts` | Cliente HTTP, cache localStorage, AbortController |
| `src/features/servicios/hooks/useDebounce.ts` | Debounce de inputs |
| `src/features/servicios/hooks/useSearchSession.ts` | Gestión de session tokens |
| `src/features/servicios/hooks/useGeocoding.ts` | Cache en sesión, geocodificación |

### Base de datos

| Tabla | Propósito |
|---|---|
| `google_places_cache` | Cache persistente de autocomplete y Place Details |
| `user_address_history` | Historial de direcciones por usuario |

---

## 10. Resumen de reducción de costos

| Optimización | Reducción estimada | Estado |
|---|---|---|
| Debounce 500ms | 40–80% | ✅ |
| Mínimo 3 caracteres | 20–30% | ✅ |
| Session tokens | Agrupa Autocomplete + Details | ✅ |
| Cancelar requests anteriores | 10–15% | ✅ |
| Cache Redis (memoria) | 15–25% | ✅ |
| Cache BD (persistente) | 30–70% | ✅ |
| Cache localStorage (frontend) | Elimina re-consultas en navegador | ✅ |
| Cache en sesión React | Elimina re-consultas en formulario | ✅ |
| Historial de direcciones | 10–20% | ✅ |
| Rate limiting | Protección de abuso | ✅ |
| Normalización de queries | Mejora hit rate del cache | ✅ |
| Restricción geográfica | Mejora precisión, reduce ruido | ✅ |
| Límite 5 resultados | Reduce payload | ✅ |
| Fallback a cache | Resiliencia ante fallos de Google | ✅ |
| **Reducción total estimada** | **80–90%** | ✅ |
