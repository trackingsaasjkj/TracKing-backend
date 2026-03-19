import { Injectable, NotFoundException } from '@nestjs/common';
import { LocationRepository } from '../../infrastructure/location.repository';
import { MensajeroRepository } from '../../../mensajeros/infrastructure/mensajero.repository';
import { validarPuedeEnviarUbicacion } from '../../domain/rules/validar-tracking.rule';
import { RegisterLocationDto } from '../dto/register-location.dto';

@Injectable()
export class RegistrarUbicacionUseCase {
  constructor(
    private readonly locationRepo: LocationRepository,
    private readonly mensajeroRepo: MensajeroRepository,
  ) {}

  async execute(dto: RegisterLocationDto, courier_id: string, company_id: string) {
    const mensajero = await this.mensajeroRepo.findById(courier_id, company_id);
    if (!mensajero) throw new NotFoundException('Mensajero no encontrado');

    // Spec rule: only IN_SERVICE couriers may send location
    validarPuedeEnviarUbicacion(mensajero.operational_status as any);

    return this.locationRepo.create({
      company_id,
      courier_id,
      latitude: dto.latitude,
      longitude: dto.longitude,
      accuracy: dto.accuracy,
    });
  }
}
