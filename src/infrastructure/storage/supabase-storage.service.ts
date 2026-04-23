import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseStorageService {
  private readonly client: SupabaseClient;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    const url = this.config.getOrThrow<string>('SUPABASE_URL');
    const key = this.config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');
    this.bucket = this.config.getOrThrow<string>('SUPABASE_STORAGE_BUCKET');
    this.client = createClient(url, key);
  }

  /**
   * Sube un archivo al bucket de evidencias y retorna la URL pública.
   * El path incluye company_id para aislar archivos por tenant.
   */
  async upload(
    file: Express.Multer.File,
    company_id: string,
    service_id: string,
  ): Promise<string> {
    const ext = file.originalname.split('.').pop() ?? 'jpg';
    const path = `${company_id}/${service_id}.${ext}`;

    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(path, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) {
      throw new InternalServerErrorException(`Error al subir evidencia: ${error.message}`);
    }

    // Store the storage path (not the public URL) so we can generate signed URLs later
    return path;
  }

  /**
   * Returns the configured bucket name.
   */
  getBucketName(): string {
    return this.bucket;
  }

  /**
   * Genera una URL firmada temporal (1 hora) para acceder a un archivo privado.
   */
  async getSignedUrl(storagePath: string, expiresInSeconds = 3600): Promise<string> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error || !data?.signedUrl) {
      throw new InternalServerErrorException(`Error al generar URL firmada: ${error?.message}`);
    }

    return data.signedUrl;
  }
}
