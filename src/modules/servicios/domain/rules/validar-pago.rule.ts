import { PaymentMethod, PaymentStatus } from '@prisma/client';

/**
 * Determina el payment_status inicial al crear un servicio.
 * - CASH / TRANSFER → PAID  (se asume cobrado en el momento)
 * - CREDIT          → UNPAID (se cobra después)
 */
export function calcularPaymentStatusInicial(method: PaymentMethod): PaymentStatus {
  return method === PaymentMethod.CREDIT ? PaymentStatus.UNPAID : PaymentStatus.PAID;
}

/**
 * Cuando el mensajero marca un servicio como UNPAID:
 * - El payment_method cambia a CREDIT automáticamente.
 */
export function resolverCambioANoPagado(): { payment_method: PaymentMethod; payment_status: PaymentStatus } {
  return { payment_method: PaymentMethod.CREDIT, payment_status: PaymentStatus.UNPAID };
}

/**
 * Cuando el mensajero marca un servicio como PAID (cobro en efectivo):
 * - El payment_method cambia a CASH y payment_status a PAID.
 */
export function resolverCambioAPagado(): { payment_method: PaymentMethod; payment_status: PaymentStatus } {
  return { payment_method: PaymentMethod.CASH, payment_status: PaymentStatus.PAID };
}
