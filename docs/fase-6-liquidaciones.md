# FASE 6 — Liquidaciones

## Objetivo
Calcular y registrar pagos a mensajeros y facturación a clientes basados en servicios entregados.

## Entidades involucradas
- `courier_settlement`
- `customer_settlement`
- `settlement_rule`
- `service`

## Endpoints planificados

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| POST | `/api/liquidations/generate` | ADMIN | Generar liquidación por rango de fechas |
| GET | `/api/liquidations` | ADMIN, AUX | Listar liquidaciones |
| GET | `/api/liquidations/:id` | ADMIN, AUX | Detalle de liquidación |
| GET | `/api/liquidations/earnings` | ADMIN | Resumen de ganancias |
| GET | `/api/liquidations/rules` | ADMIN | Ver reglas de liquidación |
| POST | `/api/liquidations/rules` | ADMIN | Crear regla de liquidación |

## Reglas de negocio

- Solo se liquidan servicios en estado `DELIVERED`
- Se aplican las reglas activas (`settlement_rule.active = true`) de la empresa
- Tipos de regla: `PERCENTAGE` (% sobre `delivery_price`) o `FIXED` (monto fijo por servicio)
- Una liquidación cubre un rango de fechas (`start_date` → `end_date`)
- Los servicios liquidados no se vuelven a incluir en futuras liquidaciones

## Estructura esperada

```
src/modules/liquidaciones/
├── domain/
│   └── rules/
│       ├── calcular-liquidacion.rule.ts
│       └── validar-liquidacion.rule.ts
├── infrastructure/
│   └── liquidacion.repository.ts
├── application/
│   ├── dto/
│   │   ├── generar-liquidacion.dto.ts
│   │   └── create-rule.dto.ts
│   └── use-cases/
│       ├── generar-liquidacion.use-case.ts
│       └── consultar-liquidaciones.use-case.ts
├── liquidaciones.controller.ts
└── liquidaciones.module.ts
```

## DTO esperado

```json
POST /api/liquidations/generate
{
  "courier_id": "uuid",
  "start_date": "2025-01-01",
  "end_date": "2025-01-31"
}
```

## Lógica de cálculo

```
Para cada servicio DELIVERED en el rango:
  Si regla es PERCENTAGE: ganancia = delivery_price * (value / 100)
  Si regla es FIXED:      ganancia = value

total_earned = suma de ganancias de todos los servicios
total_services = count de servicios en el rango
```
