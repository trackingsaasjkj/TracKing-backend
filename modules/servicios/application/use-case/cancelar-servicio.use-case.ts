import { ServicioStateMachine } from "../../domain/state-machine/servicio.machine";

export class CancelarServicioUseCase {
  constructor(private servicioRepo, private historyRepo) {}

  async execute({ serviceId, userId }) {

    const servicio = await this.servicioRepo.findById(serviceId);

    if (!ServicioStateMachine.canBeCancelled(servicio.status)) {
      throw new Error("Este servicio no puede ser cancelado");
    }

    await this.servicioRepo.update(serviceId, {
      status: "CANCELLED"
    });

    await this.historyRepo.create({
      service_id: serviceId,
      previous_status: servicio.status,
      new_status: "CANCELLED",
      user_id: userId
    });

    return { success: true };
  }
}
