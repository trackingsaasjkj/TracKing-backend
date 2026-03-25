export const planSpec = {
  entidad: 'Plan',

  campos: {
    requeridos: ['name', 'max_couriers', 'max_services_per_month', 'max_users', 'price'],
    opcionales: ['description'],
  },

  reglas: {
    nombreUnico: true,
    soloSuperAdminPuedeGestionar: true,
    maxServicesPerMonth: {
      cero_significa_ilimitado: true,
    },
    desactivar: {
      noAfectaSuscripcionesExistentes: true,
      noSePuedeEliminarConSuscripcionesActivas: true,
    },
  },

  estados: {
    active: true,
    inactive: false,
  },
} as const;

export const suscripcionSpec = {
  entidad: 'Subscription',

  estados: ['ACTIVE', 'CANCELLED', 'EXPIRED'] as const,

  transiciones: {
    ACTIVE: ['CANCELLED', 'EXPIRED'],
    CANCELLED: [],
    EXPIRED: [],
  },

  campos: {
    requeridos: ['company_id', 'plan_id', 'start_date'],
    opcionales: ['end_date'],
    defaults: {
      end_date: 'start_date + 1 mes',
      status: 'ACTIVE',
    },
  },

  reglas: {
    unaActivaPorEmpresa: true,
    alCrearNueva: {
      cancelaAnteriorAutomaticamente: true,
    },
    endDate: {
      defaultUnMesDesdeStartDate: true,
      debeSerPosteriorAStartDate: true,
    },
    permisos: {
      crear: ['SUPER_ADMIN'],
      cancelar: ['SUPER_ADMIN'],
      consultar: ['SUPER_ADMIN', 'ADMIN'],
    },
    respuesta: {
      incluyeDatosDePlan: true,
    },
  },

  validaciones: {
    empresa: {
      debeTenerSuscripcionActiva: false, // no es obligatorio, pero se puede consultar
    },
    plan: {
      debeExistir: true,
      debeEstarActivo: true,
    },
    fechas: {
      startDateRequerida: true,
      endDateOpcional: true,
      endDateDefaultUnMes: true,
      endDateDebeSerPosteriorAStartDate: true,
    },
  },
} as const;
