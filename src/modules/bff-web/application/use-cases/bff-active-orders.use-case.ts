import { Injectable } from '@nestjs/common';
import { ConsultarServiciosUseCase } from '../../../servicios/application/use-cases/consultar-servicios.use-case';
import { ConsultarMensajerosUseCase } from '../../../mensajeros/application/use-cases/consultar-mensajeros.use-case';

@Injectable()
export class BffActiveOrdersUseCase {
  constructor(
    private readonly consultarServicios: ConsultarServiciosUseCase,
    private readonly consultarMensajeros: ConsultarMensajerosUseCase,
  ) {}

  async execute(company_id: string) {
    const [services, availableCouriers] = await Promise.all([
      this.consultarServicios.findAll(company_id),
      this.consultarMensajeros.findAvailableAndInService(company_id),
    ]);

    return {
      services,
      available_couriers: availableCouriers,
    };
  }
}
