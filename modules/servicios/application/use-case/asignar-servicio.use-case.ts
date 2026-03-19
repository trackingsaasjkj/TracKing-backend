import { validarAsignacion } from "../../domain/rules/validar-asignacion.rule";
import { validarTransicion } from "../../domain/rules/validar-transicion.rule";

export class AsignarServicioUseCase {
  constructor(private servicioRepo, private courierRepo, private historyRepo) {}

  async execute({ serviceId, courierId, userId }) {

    const servicio = await this.servicioRepo.findById(serviceId);
    const courier = await this.courierRepo.findById(courierId);

    validarAsignacion({
      courier,
      estado: servicio.status
    });

    validarTransicion(servicio.status, "ASSIGNED");

    await this.servicioRepo.update(serviceId, {
      courier_id: courierId,
      status: "ASSIGNED",
      assignment_date: new Date()
    });

    await this.historyRepo.create({
      service_id: serviceId,
      previous_status: servicio.status,
      new_status: "ASSIGNED",
      user_id: userId
    });

    return { success: true };
  }
}
