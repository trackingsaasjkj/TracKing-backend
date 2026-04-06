# Cambios en el módulo de Servicios — Payment Method, Payment Status e Is Settled

> Guía de integración para desarrolladores Frontend (Web) y Mobile.

---

## Resumen de cambios

Se agregaron tres campos nuevos al modelo `Service`:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `payment_method` | enum | Método de pago: `CASH`, `TRANSFER`, `CREDIT` |
| `payment_status` | enum | Estado del pago: `PAID`, `UNPAID` |
| `is_settled_courier` | boolean | `true` si el servicio fue incluido en una liquidación de mensajero |
| `is_settled_customer` | boolean | `true` si el servicio fue incluido en una liquidación de cliente |

---

## Lógica de negocio

### Al crear un servicio

El `payment_status` se asigna automáticamente según el `payment_method`:

| payment_method | payment_status inicial |
|----------------|----------------------|
| `CASH` | `PAID` |
| `TRANSFER` | `PAID` |
| `CREDIT` | `UNPAID` |

### Cambiar estado de pago (endpoint nuevo)

El mensajero o el admin pueden cambiar el estado de pago. El sistema aplica estas reglas automáticamente:

| Acción | payment_status resultante | payment_method resultante |
|--------|--------------------------|--------------------------|
| Marcar como `UNPAID` | `UNPAID` | `CREDIT` |
| Marcar como `PAID` | `PAID` | `CASH` |

### Is Settled

- `is_settled_courier: false` — el servicio aún no ha sido incluido en una liquidación de mensajero
- `is_settled_courier: true` — fue contabilizado al generar una liquidación de mensajero
- `is_settled_customer: false` — el servicio aún no ha sido incluido en una liquidación de cliente
- `is_settled_customer: true` — fue contabilizado al generar una liquidación de cliente

Ambos campos se marcan automáticamente al generar la liquidación correspondiente. No se pueden modificar manualmente.

---

## Cambios en la API

### Crear servicio — campo actualizado

`POST /api/services`

El campo `payment_method` ahora es un enum estricto:

```json
{
  "payment_method": "CASH"
}
```

Valores permitidos: `CASH`, `TRANSFER`, `CREDIT`

### Nuevo endpoint — Cambiar estado de pago

```
POST /api/services/:id/payment          ← panel web (ADMIN, AUX, COURIER)
POST /api/courier/services/:id/payment  ← app mobile (COURIER)
```

**Body:**
```json
{
  "payment_status": "UNPAID"
}
```

Valores permitidos: `PAID`, `UNPAID`

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-servicio",
    "payment_method": "CREDIT",
    "payment_status": "UNPAID",
    "is_settled": false,
    "status": "IN_TRANSIT",
    ...
  }
}
```

### Respuesta de servicio — campos nuevos

Todos los endpoints que retornan un servicio ahora incluyen los tres campos:

```json
{
  "id": "uuid",
  "payment_method": "CASH",
  "payment_status": "PAID",
  "is_settled_courier": false,
  "is_settled_customer": false,
  "status": "DELIVERED",
  ...
}
```

---

## Guía para el Frontend Web

### Crear servicio

```ts
const PAYMENT_METHODS = [
  { value: 'CASH',     label: 'Efectivo' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'CREDIT',   label: 'Crédito' },
];
```

### Mostrar badges en la lista de servicios

```ts
const PAYMENT_STATUS_BADGE = {
  PAID:   { label: 'Pagado',    color: 'green' },
  UNPAID: { label: 'No pagado', color: 'red'   },
};

const SETTLED_BADGE = {
  true:  { label: 'Liquidado',   color: 'blue' },
  false: { label: 'Sin liquidar', color: 'gray' },
};
```

### Cambiar estado de pago

```ts
async function cambiarPago(serviceId: string, status: 'PAID' | 'UNPAID', token: string) {
  const res = await fetch(`/api/services/${serviceId}/payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ payment_status: status }),
  });
  return res.json();
}
```

### Filtrar servicios

```ts
// Servicios no pagados
const unpaid = servicios.filter(s => s.payment_status === 'UNPAID');

// Servicios entregados pendientes de liquidar (mensajero)
const pendingCourierSettlement = servicios.filter(
  s => s.status === 'DELIVERED' && s.is_settled_courier === false
);

// Servicios entregados pendientes de liquidar (cliente)
const pendingCustomerSettlement = servicios.filter(
  s => s.status === 'DELIVERED' && s.is_settled_customer === false
);
```

---

## Guía para el Mobile (Mensajero)

### Cambiar estado de pago en campo

```ts
async function cambiarEstadoPago(
  serviceId: string,
  status: 'PAID' | 'UNPAID',
  token: string,
) {
  const res = await fetch(`${BASE_URL}/api/courier/services/${serviceId}/payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ payment_status: status }),
  });
  return res.json();
}
```

### Flujo típico con cobro en campo

```
Caso 1 — Cliente no tiene efectivo:
  Servicio creado con CASH → payment_status: PAID
  Cliente no paga → mensajero marca UNPAID
  → payment_method cambia a CREDIT automáticamente

Caso 2 — Cliente paga crédito en entrega:
  Servicio creado con CREDIT → payment_status: UNPAID
  Cliente paga al recibir → mensajero marca PAID
  → payment_method cambia a CASH automáticamente
```

### Badges en React Native

```tsx
function PaymentBadge({ status }: { status: 'PAID' | 'UNPAID' }) {
  return (
    <View style={{ backgroundColor: status === 'PAID' ? '#22c55e' : '#ef4444', borderRadius: 4, padding: 4 }}>
      <Text style={{ color: 'white' }}>{status === 'PAID' ? 'Pagado' : 'No pagado'}</Text>
    </View>
  );
}

function SettledBadge({ isSettled }: { isSettled: boolean }) {
  if (!isSettled) return null;
  return (
    <View style={{ backgroundColor: '#3b82f6', borderRadius: 4, padding: 4 }}>
      <Text style={{ color: 'white' }}>Liquidado</Text>
    </View>
  );
}
```

---

## Referencia rápida de endpoints de pago

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| POST | `/api/services/:id/payment` | ADMIN, AUX, COURIER | Cambiar estado de pago (web) |
| POST | `/api/courier/services/:id/payment` | COURIER | Cambiar estado de pago (mobile) |
