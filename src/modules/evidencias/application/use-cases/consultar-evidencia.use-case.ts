import { Injectable, NotFoundException } from '@nestjs/common';
import { EvidenciaRepository } from '../../infrastructure/evidencia.repository';
import { ServicioRepository } from '../../../servicios/infrastructure/repositories/servicio.repository';
import { SupabaseStorageService } from '../../../../infrastructure/storage/supabase-storage.service';

@Injectable()
export class ConsultarEvidenciaUseCase {
  constructor(
    private readonly evidenciaRepo: EvidenciaRepository,
    private readonly servicioRepo: ServicioRepository,
    private readonly storageService: SupabaseStorageService,
  ) {}

  async execute(service_id: string, company_id: string) {
    const servicio = await this.servicioRepo.findById(service_id, company_id);
    if (!servicio) throw new NotFoundException('Servicio no encontrado');

    const evidencia = await this.evidenciaRepo.findByServiceId(service_id, company_id);
    if (!evidencia) throw new NotFoundException('No hay evidencia registrada para este servicio');

    // image_url may be a storage path (new uploads) or a legacy full public URL.
    // If it looks like a path (no "http"), generate a signed URL.
    // If it's already a full URL, extract the path after the bucket name.
    let storagePath = evidencia.image_url;

    if (storagePath.startsWith('http')) {
      // Extract path after "/object/public/<bucket>/" or "/object/sign/<bucket>/"
      const bucketMarker = `/Evidencias/`;
      const idx = storagePath.indexOf(bucketMarker);
      if (idx !== -1) {
        storagePath = storagePath.slice(idx + bucketMarker.length);
      }
    }

    const signed_url = await this.storageService.getSignedUrl(storagePath);

    return { ...evidencia, image_url: signed_url };
  }
}
