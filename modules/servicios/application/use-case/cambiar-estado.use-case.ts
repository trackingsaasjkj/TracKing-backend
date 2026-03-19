import { validarTransicion } from "../../domain/rules/validar-transicion.rule";
import { validarEntrega } from "../../domain/rules/validar-entrega.rule";

export class CambiarEstadoServicioUseCase {
  constructor(private servicioRepo, private historyRepo, private evidenceRepo) {}

  async execute({ serviceId, nuevoEstado, userId }) {

    const servicio = await this.servicioRepo.findById(serviceId);

    validarTransicion(servicio.status, nuevoEstado);

    if (nuevoEstado === "DELIVERED") {
      const evidencia = await this.evidenceRepo.findByServiceId(serviceId);

      validarEntrega({
        estado: servicio.status,
        evidencia
      });
    }

    await this.servicioRepo.update(serviceId, {
      status: nuevoEstado,
      delivery_date: nuevoEstado === "DELIVERED" ? new Date() : null
    });

    await this.historyRepo.create({
      service_id: serviceId,
      previous_status: servicio.status,
      new_status: nuevoEstado,
      user_id: userId
    });

    return { success: true };
  }
}
