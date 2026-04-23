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
    // If it looks like a path (no "http"), use it directly.
    // If it's already a full URL, extract only the path relative to the bucket root.
    let storagePath = evidencia.image_url;

    if (storagePath.startsWith('http')) {
      // Supabase storage URLs have the format:
      // .../storage/v1/object/public/<bucket>/<path>
      // .../storage/v1/object/sign/<bucket>/<path>
      // We need to extract <path> (everything after the bucket name)
      const bucketName = this.storageService.getBucketName();
      const markers = [
        `/object/public/${bucketName}/`,
        `/object/sign/${bucketName}/`,
        `/object/authenticated/${bucketName}/`,
        `/${bucketName}/`,
      ];
      let extracted = false;
      for (const marker of markers) {
        const idx = storagePath.indexOf(marker);
        if (idx !== -1) {
          storagePath = storagePath.slice(idx + marker.length);
          // Remove any query params (e.g. ?token=...)
          const qIdx = storagePath.indexOf('?');
          if (qIdx !== -1) storagePath = storagePath.slice(0, qIdx);
          extracted = true;
          break;
        }
      }
      if (!extracted) {
        // Fallback: try to extract path after last occurrence of bucket name
        const bucketIdx = storagePath.lastIndexOf(`/${bucketName}/`);
        if (bucketIdx !== -1) {
          storagePath = storagePath.slice(bucketIdx + bucketName.length + 2);
          const qIdx = storagePath.indexOf('?');
          if (qIdx !== -1) storagePath = storagePath.slice(0, qIdx);
        }
      }
    }

    const signed_url = await this.storageService.getSignedUrl(storagePath);

    return { ...evidencia, image_url: signed_url };
  }
}
