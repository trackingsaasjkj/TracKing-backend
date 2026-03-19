# FASE 4 — Evidencias

## Objetivo
Registro y consulta de evidencias fotográficas de entrega.

## Arquitectura

```
src/modules/evidencias/
├── domain/
│   └── rules/validar-evidencia.rule.ts
├── infrastructure/
│   └── evidencia.repository.ts
├── application/
│   ├── dto/subir-evidencia.dto.ts
│   └── use-cases/
│       ├── subir-evidencia.use-case.ts
│       └── consultar-evidencia.use-case.ts
├── evidencias.controller.ts
└── evidencias.module.ts
```

## Endpoints

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| POST | `/api/services/:id/evidence` | ADMIN, AUX, COURIER | Subir evidencia |
| GET | `/api/services/:id/evidence` | Todos (JWT) | Consultar evidencia |

## Reglas de negocio

- Solo se puede subir evidencia cuando el servicio está en `IN_TRANSIT`
- Re-subir reemplaza la evidencia existente (upsert — DB tiene `service_id UNIQUE`)
- La evidencia es requerida para poder marcar el servicio como `DELIVERED`
- Toda consulta está scoped por `company_id` (multi-tenant)

## Formato del body

```json
POST /api/services/:id/evidence
{
  "image_url": "https://cdn.example.com/evidencias/foto-entrega.jpg"
}
```

## Integración con almacenamiento

Actualmente acepta una URL pre-firmada o pública. Para integrar upload directo:

1. Agregar `multer` y `@nestjs/platform-express`
2. Crear `src/infrastructure/storage/s3.service.ts` o `cloudinary.service.ts`
3. Reemplazar `SubirEvidenciaDto.image_url` por `@UploadedFile()` en el controller
4. El use-case recibe la URL resultante del servicio de storage

## Flujo de prueba (Swagger)

```
1. Tener un servicio en estado IN_TRANSIT
2. POST /api/services/:id/evidence → { "image_url": "https://..." }
3. GET /api/services/:id/evidence → verificar evidencia guardada
4. POST /api/services/:id/status → { "status": "DELIVERED" } → ahora funciona
```
