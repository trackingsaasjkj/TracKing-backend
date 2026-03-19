import { Injectable, NotFoundException } from '@nestjs/common';
import { EvidenciaRepository } from '../../infrastructure/evidencia.repository';
import { ServicioRepository } from '../../../servicios/infrastructure/repositories/servicio.repository';

@Injectable()
export class ConsultarEvidenciaUseCase {
  constructor(
    private readonly evidenciaRepo: EvidenciaRepository,
    private readonly servicioRepo: ServicioRepository,
  ) {}

  async execute(service_id: string, company_id: string) {
    // Ensure service belongs to this company before exposing evidence
    const servicio = await this.servicioRepo.findById(service_id, company_id);
    if (!servicio) throw new NotFoundException('Servicio no encontrado');

    const evidencia = await this.evidenciaRepo.findByServiceId(service_id, company_id);
    if (!evidencia) throw new NotFoundException('No hay evidencia registrada para este servicio');

    return evidencia;
  }
}
