export const liquidacionSpec = {
  estados: ["UNSETTLED", "SETTLED"] as const,
  reglas: {
    tiposRegla: ["PERCENTAGE", "FIXED"] as const,
    calculo: { porcentaje: "total_earned * (value / 100)", fijo: "value" },
    condicionesGeneracion: { soloServiciosEntregados: true, rangoFechasObligatorio: true },
    condicionesCierre: { noPermitirModificar: true }
  },
  validaciones: {
    reglas: { debeExistirReglaActiva: true },
    liquidacion: { totalServiciosDebeCoincidir: true, totalGanadoDebeSerPositivo: true }
  },
  entidades: {
    courierSettlement: { campos: ["courier_id","start_date","end_date","total_services","total_earned"] },
    customerSettlement: { campos: ["start_date","end_date","total_services","total_invoiced"] }
  }
};
