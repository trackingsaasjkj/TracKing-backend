import { Injectable, NotFoundException } from '@nestjs/common';
import { MensajeroRepository } from '../../infrastructure/mensajero.repository';

@Injectable()
export class ConsultarMensajerosUseCase {
  constructor(private readonly mensajeroRepo: MensajeroRepository) {}

  async findAll(company_id: string) {
    return this.mensajeroRepo.findAll(company_id);
  }

  async findActivos(company_id: string) {
    return this.mensajeroRepo.findAllActive(company_id);
  }

  async findOne(id: string, company_id: string) {
    const mensajero = await this.mensajeroRepo.findById(id, company_id);
    if (!mensajero) throw new NotFoundException('Mensajero no encontrado');
    return mensajero;
  }

  async findCourierByUserId(user_id: string, company_id: string) {
    const mensajero = await this.mensajeroRepo.findByUserId(user_id, company_id);
    if (!mensajero) throw new NotFoundException('Perfil de mensajero no encontrado');
    return mensajero;
  }

  async findMyServices(courier_id: string, company_id: string) {
    const mensajero = await this.mensajeroRepo.findById(courier_id, company_id);
    if (!mensajero) throw new NotFoundException('Mensajero no encontrado');
    return this.mensajeroRepo.findMyServices(courier_id, company_id);
  }
}
