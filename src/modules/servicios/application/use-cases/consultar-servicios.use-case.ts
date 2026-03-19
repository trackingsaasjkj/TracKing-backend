import { Injectable, NotFoundException } from '@nestjs/common';
import { ServicioRepository } from '../../infrastructure/repositories/servicio.repository';
import { HistorialRepository } from '../../infrastructure/repositories/historial.repository';
import { ServiceStatus } from '@prisma/client';

@Injectable()
export class ConsultarServiciosUseCase {
  constructor(
    private readonly servicioRepo: ServicioRepository,
    private readonly historialRepo: HistorialRepository,
  ) {}

  async findAll(company_id: string, filters?: { status?: ServiceStatus; courier_id?: string }) {
    return this.servicioRepo.findAllByCompany(company_id, filters);
  }

  async findOne(service_id: string, company_id: string) {
    const servicio = await this.servicioRepo.findById(service_id, company_id);
    if (!servicio) throw new NotFoundException('Servicio no encontrado');
    return servicio;
  }

  async findHistorial(service_id: string, company_id: string) {
    // Ensure service belongs to company first
    const servicio = await this.servicioRepo.findById(service_id, company_id);
    if (!servicio) throw new NotFoundException('Servicio no encontrado');
    return this.historialRepo.findByService(service_id, company_id);
  }
}
