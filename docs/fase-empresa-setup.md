# Creación de Empresa (Setup Inicial)

## Objetivo

Registrar una nueva empresa (tenant) junto con su usuario ADMIN en una sola operación atómica. Si cualquier paso falla, nada se persiste en base de datos.

## Endpoint

```
POST /api/companies/setup
```

**Acceso:** Público (no requiere JWT)

## Body

```json
{
  "company": {
    "name": "Mi Empresa SAS"
  },
  "admin": {
    "name": "Juan Pérez",
    "email": "admin@empresa.com",
    "password": "Password123!"
  }
}
```

### Validaciones

| Campo | Regla |
|-------|-------|
| `company.name` | String, requerido, máx. 150 caracteres |
| `admin.name` | String, requerido, máx. 100 caracteres |
| `admin.email` | Email válido, requerido |
| `admin.password` | String, mínimo 8 caracteres |

## Respuesta 201

```json
{
  "success": true,
  "data": {
    "company": {
      "id": "uuid",
      "name": "Mi Empresa SAS",
      "status": true,
      "created_at": "2026-01-01T00:00:00.000Z"
    },
    "admin": {
      "id": "uuid",
      "name": "Juan Pérez",
      "email": "admin@empresa.com",
      "role": "ADMIN",
      "company_id": "uuid",
      "created_at": "2026-01-01T00:00:00.000Z"
    }
  }
}
```

> La contraseña nunca se retorna en la respuesta. Se almacena hasheada con bcrypt (12 rounds).

## Errores

| Código | Causa |
|--------|-------|
| `400` | Validación de campos fallida |
| `409` | El email ya está registrado |

## Flujo interno (transacción atómica)

```
prisma.$transaction([
  1. company.create({ name })
  2. user.create({ company_id, name, email, password_hash, role: ADMIN })
])
```

Si el paso 2 falla (ej. email duplicado), el paso 1 hace rollback automático. La empresa no queda huérfana.

## Flujo de uso

```
1. POST /api/companies/setup  →  obtener company.id y admin creado
2. POST /api/auth/login       →  { email, password }
3. Usar el access_token para operar dentro de la empresa
```

## Archivos relevantes

| Archivo | Descripción |
|---------|-------------|
| `src/modules/company/application/dto/create-company-with-admin.dto.ts` | DTO de entrada |
| `src/modules/company/application/use-cases/create-company-with-admin.use-case.ts` | Lógica de negocio + transacción |
| `src/modules/company/company.controller.ts` | Controlador HTTP |
| `src/modules/company/company.module.ts` | Módulo NestJS |
