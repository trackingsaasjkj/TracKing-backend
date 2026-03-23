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
| POST | `/api/auth/register` | Público | Registro de usuario |
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

## Reglas de negocio

- Contraseñas hasheadas con bcrypt (12 rounds)
- Bloqueo tras **5 intentos fallidos** en la última hora
- Access token: 15 minutos | Refresh token: 7 días
- Refresh token de **un solo uso** — se rota en cada uso
- Todo `company_id` viene del JWT, nunca del body en endpoints protegidos
- Usuarios solo ven datos de su propia empresa

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

## Testing manual (Swagger)

1. Ir a `http://localhost:3000/api/docs`
2. Ejecutar `POST /api/companies/setup` con datos de empresa y admin
3. Ejecutar `POST /api/auth/login` con email y password del admin creado
4. Copiar el token de la respuesta (o usar cookie)
5. Hacer clic en **Authorize** → ingresar `Bearer <token>`
6. Probar endpoints protegidos
