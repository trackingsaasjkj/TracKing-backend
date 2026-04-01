export const mensajeroSpec = {
  estados: ["AVAILABLE", "UNAVAILABLE", "IN_SERVICE"] as const,
  transiciones: {
    UNAVAILABLE: ["AVAILABLE"],
    AVAILABLE: ["IN_SERVICE", "UNAVAILABLE"],
    IN_SERVICE: ["AVAILABLE"]
  },
  reglas: {
    puedeRecibirServicios: ["AVAILABLE"],
    estadoAutomatico: { cuandoSeAsignaServicio: "IN_SERVICE", cuandoFinalizaServicio: "AVAILABLE" }
  },
  validaciones: {
    asignacion: { noPuedeEstarEnServicio: true },
    tracking: { puedeEnviarUbicacion: ["IN_SERVICE"] }
  }
};
