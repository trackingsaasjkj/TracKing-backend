export const servicioSpec = {
  estados: [
    'PENDING',
    'ASSIGNED',
    'ACCEPTED',
    'IN_TRANSIT',
    'DELIVERED',
    'CANCELLED',
  ] as const,

  transiciones: {
    PENDING: ['ASSIGNED', 'CANCELLED'],
    ASSIGNED: ['ACCEPTED', 'CANCELLED'],
    ACCEPTED: ['IN_TRANSIT', 'CANCELLED'],
    IN_TRANSIT: ['DELIVERED'],
    DELIVERED: [],
    CANCELLED: [],
  },

  reglas: {
    requiereMensajero: ['ASSIGNED', 'ACCEPTED', 'IN_TRANSIT', 'DELIVERED'],
    requiereEvidencia: ['DELIVERED'],
    estadosFinales: ['DELIVERED', 'CANCELLED'],
    permiteCancelacion: ['PENDING', 'ASSIGNED', 'ACCEPTED'],
    requiereFechaAsignacion: ['ASSIGNED'],
    requiereFechaEntrega: ['DELIVERED'],
  },

  validaciones: {
    asignacion: {
      courierDebeExistir: true,
      courierDebeEstarDisponible: true,
    },
    entrega: {
      debeExistirEvidencia: true,
    },
    precios: {
      totalDebeSer: 'delivery_price + product_price',
    },
  },
};
