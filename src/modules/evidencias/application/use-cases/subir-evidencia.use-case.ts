import { Injectable, NotFoundException } from '@nestjs/common';
import { EvidenciaRepository } from '../../infrastructure/evidencia.repository';
import { ServicioRepository } from '../../../servicios/infrastructure/repositories/servicio.repository';
import { validarSubidaEvidencia } from '../../domain/rules/validar-evidencia.rule';
import { SubirEvidenciaDto } from '../dto/subir-evidencia.dto';
import { ServicioEstado } from '../../../servicios/domain/state-machine/servicio.machine';

@Injectable()
export class SubirEvidenciaUseCase {
  constructor(
    private readonly evidenciaRepo: EvidenciaRepository,
    private readonly servicioRepo: ServicioRepository,
  ) {}

  async execute(service_id: string, dto: SubirEvidenciaDto, company_id: string) {
    const servicio = await this.servicioRepo.findById(service_id, company_id);
    if (!servicio) throw new NotFoundException('Servicio no encontrado');

    validarSubidaEvidencia(servicio.status as ServicioEstado);

    return this.evidenciaRepo.upsert({
      company_id,
      service_id,
      image_url: dto.image_url,
    });
  }
}
