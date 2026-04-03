# FASE 4 — Evidencias

## Objetivo
Registro y consulta de evidencias fotográficas de entrega usando Supabase Storage.

## Arquitectura

```
src/modules/evidencias/
├── domain/
│   └── rules/validar-evidencia.rule.ts
├── infrastructure/
│   └── evidencia.repository.ts
├── application/
│   ├── dto/subir-evidencia.dto.ts          ← mantenido para compatibilidad
│   └── use-cases/
│       ├── subir-evidencia.use-case.ts     ← recibe Express.Multer.File
│       └── consultar-evidencia.use-case.ts
├── evidencias.controller.ts               ← multipart/form-data
└── evidencias.module.ts

src/infrastructure/storage/
├── supabase-storage.service.ts            ← sube archivo a Supabase Storage
└── storage.module.ts                      ← @Global(), exporta SupabaseStorageService
```

## Endpoints

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| POST | `/api/services/:id/evidence` | ADMIN, AUX, COURIER | Subir evidencia (multipart/form-data) |
| GET | `/api/services/:id/evidence` | Todos (JWT) | Consultar evidencia |

## Reglas de negocio

- Solo se puede subir evidencia cuando el servicio está en `IN_TRANSIT`
- Re-subir reemplaza la evidencia existente (upsert — DB tiene `service_id UNIQUE`)
- La evidencia es requerida para poder marcar el servicio como `DELIVERED`
- Toda consulta está scoped por `company_id` (multi-tenant)
- Formatos permitidos: `image/jpeg`, `image/png`, `image/webp`
- Tamaño máximo: 5 MB

## Formato del request

```
POST /api/services/:id/evidence
Content-Type: multipart/form-data

Campo: file (binary) — imagen jpg, png o webp, máx 5 MB
```

## Variables de entorno requeridas

```env
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...          # Settings → API → service_role key
SUPABASE_STORAGE_BUCKET=Evidencias        # nombre del bucket creado en Supabase Storage
```

## Configuración en Supabase

1. Crear bucket `Evidencias` (privado) en Storage → New bucket
2. No se requieren políticas RLS — el backend usa `service_role` key que las bypasea
3. Límite de archivo recomendado: 5 MB (configurable en Settings → Storage)

## Flujo interno

```
Controller (multipart) → SubirEvidenciaUseCase
  → validar archivo (mime, size)
  → ServicioRepository.findById (verifica tenant + estado IN_TRANSIT)
  → validarSubidaEvidencia (domain rule)
  → SupabaseStorageService.upload → Supabase Storage
  → EvidenciaRepository.upsert (guarda URL en DB)
```

El archivo se almacena en el bucket con el path `{company_id}/{service_id}.{ext}`, lo que garantiza aislamiento por tenant y permite upsert natural (mismo path = reemplaza).

## Flujo de prueba (Swagger)

```
1. Tener un servicio en estado IN_TRANSIT
2. POST /api/services/:id/evidence → multipart con campo "file"
3. GET /api/services/:id/evidence → verificar image_url retornada
4. POST /api/services/:id/status → { "status": "DELIVERED" } → ahora funciona
```

## Tests

- `specs/evidencias.spec.ts` — 14 tests (unit + property-based)
- `src/tests/unit/evidencias/subir-evidencia.use-case.spec.ts` — tests unitarios del use-case
- `src/tests/unit/evidencias/validar-evidencia.spec.ts` — tests de la domain rule
