# FASE 1 — Autenticación, Multi-Tenant y Usuarios

## Objetivo
Autenticación segura con JWT, aislamiento por empresa y control de acceso por roles.

## Arquitectura

```
src/modules/auth/
├── domain/
│   └── token.service.ts          # JWT generation, bcrypt hashing
├── infrastructure/
│   ├── jwt.strategy.ts           # Passport JWT (cookie + Bearer)
│   └── auth.repository.ts        # Token persistence, lockout tracking
├── application/
│   ├── dto/login.dto.ts
│   ├── dto/register.dto.ts
│   └── use-cases/
│       ├── login.use-case.ts
│       ├── register.use-case.ts
│       ├── logout.use-case.ts
│       └── refresh-token.use-case.ts
├── auth.controller.ts
└── auth.module.ts

src/core/
├── guards/jwt-auth.guard.ts      # Global guard, respects @Public()
├── guards/roles.guard.ts
├── guards/permissions.guard.ts
├── decorators/public.decorator.ts
├── decorators/current-user.decorator.ts
├── decorators/roles.decorator.ts
└── decorators/permissions.decorator.ts
```

## Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/auth/login` | Público | Login, establece cookies httpOnly |
| POST | `/api/auth/register` | Público | Registro de usuario en empresa existente |
| POST | `/api/auth/logout` | JWT | Revoca tokens, limpia cookies |
| POST | `/api/auth/refresh` | Cookie | Rota refresh token (single-use) |
| GET | `/api/users` | JWT | Lista usuarios de la empresa |
| GET | `/api/users/:uuid` | JWT | Obtener usuario por UUID |
| GET | `/api/users/email/:email` | ADMIN/AUX | Buscar por email |
| POST | `/api/users` | ADMIN | Crear usuario |
| PUT | `/api/users/:uuid` | ADMIN | Actualizar usuario |
| DELETE | `/api/users/:uuid` | ADMIN | Eliminar usuario |
| POST | `/api/companies/setup` | Público | Crear empresa + admin (setup inicial) |
| GET | `/api/companies` | JWT | Listar empresas activas |

## Campos de Empresa (Company)

```typescript
{
  id: string                    // UUID
  name: string                  // Nombre legal (requerido)
  nit: string?                  // Número de identificación tributaria
  email_corporativo: string?    // Email de contacto corporativo
  telefono: string?             // Teléfono principal
  direccion: string?            // Dirección sede principal
  status: boolean               // Activa/Inactiva
  created_at: DateTime
}
```

## Campos de Usuario (User)

```typescript
{
  id: string                    // UUID
  company_id: string            // Empresa a la que pertenece
  name: string                  // Nombre completo (requerido)
  email: string                 // Email único por empresa (requerido)
  phone: string?                // Teléfono de contacto
  password_hash: string         // Bcrypt hash (requerido)
  role: UserRole                // ADMIN | AUX | COURIER | SUPER_ADMIN
  status: UserStatus            // ACTIVE | SUSPENDED
  permissions: string[]         // Array de permisos (solo para AUX)
  created_at: DateTime
}
```

## Reglas de negocio

- Contraseñas hasheadas con bcrypt (12 rounds)
- Bloqueo tras **5 intentos fallidos** en la última hora
- Access token: 15 minutos | Refresh token: 7 días
- Refresh token de **un solo uso** — se rota en cada uso
- Todo `company_id` viene del JWT, nunca del body en endpoints protegidos
- Usuarios solo ven datos de su propia empresa
- Email único por empresa (no globalmente)

## Roles y permisos

| Rol | Permisos |
|-----|----------|
| ADMIN | Todos (users:read, create, update, delete) |
| AUX | users:read |
| COURIER | Ninguno sobre usuarios |

## Flujo de autenticación

```
1. POST /api/companies/setup → crear empresa + admin en una sola operación
2. POST /api/auth/login → iniciar sesión (solo email + password)
3. Requests protegidos → Authorization: Bearer <token> o cookie access_token
4. POST /api/auth/refresh → renovar tokens cuando expiren
5. POST /api/auth/logout → cerrar sesión
```

## Endpoints Detallados

### POST /api/companies/setup
**Crear empresa + administrador (operación atómica)**

Request:
```json
{
  "company": {
    "name": "Mensajería Rápida S.A.S",
    "nit": "123456789",
    "email_corporativo": "contacto@empresa.com",
    "telefono": "+573001234567",
    "direccion": "Cra 45 #10-23, Bucaramanga"
  },
  "admin": {
    "name": "Juan García",
    "email": "juan@empresa.com",
    "password": "SecurePass123!",
    "phone": "+573009876543"
  }
}
```

Response (201):
```json
{
  "company": {
    "id": "uuid",
    "name": "Mensajería Rápida S.A.S",
    "nit": "123456789",
    "email_corporativo": "contacto@empresa.com",
    "telefono": "+573001234567",
    "direccion": "Cra 45 #10-23, Bucaramanga",
    "status": true,
    "created_at": "2026-05-01T10:00:00Z"
  },
  "admin": {
    "id": "uuid",
    "name": "Juan García",
    "email": "juan@empresa.com",
    "phone": "+573009876543",
    "role": "ADMIN",
    "company_id": "uuid",
    "created_at": "2026-05-01T10:00:00Z"
  }
}
```

### POST /api/auth/register
**Registrar usuario en empresa existente**

Request:
```json
{
  "company_id": "uuid",
  "name": "María López",
  "email": "maria@empresa.com",
  "password": "SecurePass456!",
  "phone": "+573001111111",
  "role": "AUX"
}
```

Response (201):
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "name": "María López",
    "email": "maria@empresa.com",
    "phone": "+573001111111",
    "role": "AUX",
    "company_id": "uuid"
  }
}
```

### POST /api/auth/login
**Iniciar sesión**

Request:
```json
{
  "email": "juan@empresa.com",
  "password": "SecurePass123!"
}
```

Response (200):
```json
{
  "accessToken": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "name": "Juan García",
    "email": "juan@empresa.com",
    "phone": "+573009876543",
    "role": "ADMIN",
    "company_id": "uuid"
  }
}
```

### POST /api/auth/logout
**Cerrar sesión (requiere JWT)**

Response (200):
```json
{
  "success": true
}
```

### POST /api/auth/refresh
**Renovar tokens (requiere refresh_token en cookie o Authorization header)**

Response (200):
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

## Testing manual (Swagger)

1. Ir a `http://localhost:3000/api/docs`
2. Ejecutar `POST /api/companies/setup` con datos de empresa y admin
3. Ejecutar `POST /api/auth/login` con email y password del admin creado
4. Copiar el token de la respuesta (o usar cookie)
5. Hacer clic en **Authorize** → ingresar `Bearer <token>`
6. Probar endpoints protegidos
