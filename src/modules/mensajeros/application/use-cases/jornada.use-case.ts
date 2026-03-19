import { Injectable, NotFoundException } from '@nestjs/common';
import { MensajeroRepository } from '../../infrastructure/mensajero.repository';
import { validarInicioJornada, validarFinJornada } from '../../domain/rules/validar-jornada.rule';
import { MensajeroEstado } from '../../domain/mensajero.machine';

@Injectable()
export class JornadaUseCase {
  constructor(private readonly mensajeroRepo: MensajeroRepository) {}

  async iniciar(courier_id: string, company_id: string) {
    const mensajero = await this.mensajeroRepo.findById(courier_id, company_id);
    if (!mensajero) throw new NotFoundException('Mensajero no encontrado');

    validarInicioJornada(mensajero.operational_status as MensajeroEstado);

    await this.mensajeroRepo.updateStatus(courier_id, company_id, 'AVAILABLE');
    return this.mensajeroRepo.findById(courier_id, company_id);
  }

  async finalizar(courier_id: string, company_id: string) {
    const mensajero = await this.mensajeroRepo.findById(courier_id, company_id);
    if (!mensajero) throw new NotFoundException('Mensajero no encontrado');

    const serviciosActivos = await this.mensajeroRepo.countActiveServices(courier_id, company_id);

    validarFinJornada(mensajero.operational_status as MensajeroEstado, serviciosActivos);

    await this.mensajeroRepo.updateStatus(courier_id, company_id, 'UNAVAILABLE');
    return this.mensajeroRepo.findById(courier_id, company_id);
  }
}
