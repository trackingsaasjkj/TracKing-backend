import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EvidenciaRepository } from '../../infrastructure/evidencia.repository';
import { ServicioRepository } from '../../../servicios/infrastructure/repositories/servicio.repository';
import { SupabaseStorageService } from '../../../../infrastructure/storage/supabase-storage.service';
import { validarSubidaEvidencia } from '../../domain/rules/validar-evidencia.rule';
import { ServicioEstado } from '../../../servicios/domain/state-machine/servicio.machine';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

@Injectable()
export class SubirEvidenciaUseCase {
  constructor(
    private readonly evidenciaRepo: EvidenciaRepository,
    private readonly servicioRepo: ServicioRepository,
    private readonly storageService: SupabaseStorageService,
  ) {}

  async execute(service_id: string, file: Express.Multer.File, company_id: string) {
    if (!file) throw new BadRequestException('Se requiere un archivo de imagen');
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Formato no permitido. Use jpg, png o webp');
    }
    if (file.size > MAX_SIZE_BYTES) {
      throw new BadRequestException('El archivo supera el límite de 5 MB');
    }

    const servicio = await this.servicioRepo.findById(service_id, company_id);
    if (!servicio) throw new NotFoundException('Servicio no encontrado');

    validarSubidaEvidencia(servicio.status as ServicioEstado);

    const image_url = await this.storageService.upload(file, company_id, service_id);

    return this.evidenciaRepo.upsert({ company_id, service_id, image_url });
  }
}
