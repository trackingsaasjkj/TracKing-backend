import { Injectable, NotFoundException } from '@nestjs/common';
import { MensajeroRepository } from '../../infrastructure/mensajero.repository';
import { PaginationDto } from '../../../../core/dto/pagination.dto';
import { ServiceStatus } from '@prisma/client';

@Injectable()
export class ConsultarMensajerosUseCase {
  constructor(private readonly mensajeroRepo: MensajeroRepository) {}

  async findAll(company_id: string, pagination?: PaginationDto) {
    if (pagination) {
      const page = pagination.page ?? 1;
      const limit = pagination.limit ?? 20;
      return this.mensajeroRepo.findAllPaginated(company_id, { page, limit });
    }
    return this.mensajeroRepo.findAll(company_id);
  }

  async findActivos(company_id: string) {
    return this.mensajeroRepo.findAllActive(company_id);
  }

  async findAvailableAndInService(company_id: string) {
    return this.mensajeroRepo.findAvailableAndInService(company_id);
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

  async findMyServiceById(service_id: string, courier_id: string, company_id: string) {
    const service = await this.mensajeroRepo.findMyServiceById(service_id, courier_id, company_id);
    if (!service) throw new NotFoundException('Servicio no encontrado');
    return service;
  }

  async findMyServicesHistory(    courier_id: string,
    company_id: string,
    filters: { status?: ServiceStatus },
    pagination: PaginationDto,
  ) {
    const mensajero = await this.mensajeroRepo.findById(courier_id, company_id);
    if (!mensajero) throw new NotFoundException('Mensajero no encontrado');
    return this.mensajeroRepo.findMyServicesPaginated(courier_id, company_id, filters, {
      page: pagination.page ?? 1,
      limit: pagination.limit ?? 20,
    });
  }
}
