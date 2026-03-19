import { Injectable, NotFoundException } from '@nestjs/common';
import { LocationRepository } from '../../infrastructure/location.repository';
import { MensajeroRepository } from '../../../mensajeros/infrastructure/mensajero.repository';

@Injectable()
export class ConsultarUbicacionUseCase {
  constructor(
    private readonly locationRepo: LocationRepository,
    private readonly mensajeroRepo: MensajeroRepository,
  ) {}

  async findLast(courier_id: string, company_id: string) {
    await this.assertCourierExists(courier_id, company_id);
    const location = await this.locationRepo.findLast(courier_id, company_id);
    if (!location) throw new NotFoundException('Sin ubicación registrada para este mensajero');
    return location;
  }

  async findHistory(
    courier_id: string,
    company_id: string,
    opts?: { from?: Date; to?: Date; limit?: number },
  ) {
    await this.assertCourierExists(courier_id, company_id);
    return this.locationRepo.findHistory(courier_id, company_id, opts);
  }

  private async assertCourierExists(courier_id: string, company_id: string) {
    const mensajero = await this.mensajeroRepo.findById(courier_id, company_id);
    if (!mensajero) throw new NotFoundException('Mensajero no encontrado');
  }
}
