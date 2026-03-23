# Módulo Customers (Clientes)

## Objetivo

Gestionar los clientes (remitentes/cuentas) asociados a cada empresa. Los clientes son entidades reutilizables que se vinculan a los servicios de entrega.

## Endpoints

Base: `/api/customers` · Requiere JWT · Roles: `ADMIN`, `AUX`

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/api/customers` | ADMIN, AUX | Listar clientes activos de la empresa |
| GET | `/api/customers/:id` | ADMIN, AUX | Obtener cliente por UUID |
| POST | `/api/customers` | ADMIN, AUX | Crear cliente |
| PUT | `/api/customers/:id` | ADMIN, AUX | Actualizar datos del cliente |
| DELETE | `/api/customers/:id` | ADMIN | Desactivar cliente (soft delete) |

## Crear cliente

```
POST /api/customers
Authorization: Bearer <token>

{
  "name": "Pedro Gómez",
  "address": "Calle 10 #20-30, Bogotá",
  "phone": "3001234567",
  "email": "pedro@correo.com"
}
```

`name` y `address` son requeridos. `phone` y `email` son opcionales.

**Respuesta 201:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "company_id": "uuid",
    "name": "Pedro Gómez",
    "address": "Calle 10 #20-30, Bogotá",
    "phone": "3001234567",
    "email": "pedro@correo.com",
    "status": true,
    "created_at": "2026-01-01T00:00:00.000Z"
  }
}
```

## Integración con servicios

Al crear un servicio (`POST /api/services`) hay dos formas de asociar un cliente:

**Opción A — Cliente existente:**
```json
{
  "customer_id": "uuid-del-cliente",
  ...
}
```

**Opción B — Crear cliente en el momento:**
```json
{
  "customer_name": "Pedro Gómez",
  "customer_address": "Calle 10 #20-30",
  "customer_phone": "3001234567",
  ...
}
```
Si no se provee `customer_id`, el sistema crea el cliente automáticamente con los campos `customer_*` y lo vincula al servicio.

## Reglas de negocio

- Todo scoped por `company_id` del JWT
- El DELETE es soft delete (`status: false`) — el registro permanece para mantener integridad referencial con servicios históricos
- Clientes inactivos no aparecen en el listado general

## Archivos

| Archivo | Descripción |
|---------|-------------|
| `src/modules/customers/application/dto/create-customer.dto.ts` | DTO de creación |
| `src/modules/customers/application/dto/update-customer.dto.ts` | DTO de actualización |
| `src/modules/customers/application/use-cases/customers.use-cases.ts` | Lógica de negocio |
| `src/modules/customers/infrastructure/customers.repository.ts` | Acceso a datos |
| `src/modules/customers/customers.controller.ts` | Controlador HTTP |
| `src/modules/customers/customers.module.ts` | Módulo NestJS |
