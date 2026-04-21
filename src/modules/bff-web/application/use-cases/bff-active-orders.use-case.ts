import { Injectable } from '@nestjs/common';
import { ServiceStatus } from '@prisma/client';
import { ConsultarServiciosUseCase } from '../../../servicios/application/use-cases/consultar-servicios.use-case';
import { ConsultarMensajerosUseCase } from '../../../mensajeros/application/use-cases/consultar-mensajeros.use-case';
import { CacheService } from '../../../../infrastructure/cache/cache.service';

const ACTIVE_STATUSES: ServiceStatus[] = [
  ServiceStatus.PENDING,
  ServiceStatus.ASSIGNED,
  ServiceStatus.ACCEPTED,
  ServiceStatus.IN_TRANSIT,
];

@Injectable()
export class BffActiveOrdersUseCase {
  constructor(
    private readonly consultarServicios: ConsultarServiciosUseCase,
    private readonly consultarMensajeros: ConsultarMensajerosUseCase,
    private readonly cache: CacheService,
  ) {}

  async execute(company_id: string) {
    const key = `bff:active-orders:active:${company_id}`;
    const cached = await this.cache.get(key);
    if (cached !== null) return cached;

    const [services, availableCouriers] = await Promise.all([
      this.consultarServicios.findAll(company_id, { status: ACTIVE_STATUSES }),
      this.consultarMensajeros.findAvailableAndInService(company_id),
    ]);

    const result = {
      services,
      available_couriers: availableCouriers,
    };

    await this.cache.set(key, result, 20);
    return result;
  }
}
