import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class EvidenciaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByServiceId(service_id: string, company_id: string) {
    return this.prisma.evidence.findFirst({ where: { service_id, company_id } });
  }

  /**
   * Upsert — DB has service_id UNIQUE so we replace on conflict.
   * This satisfies the spec intent of "multiple uploads" by allowing re-upload.
   */
  async upsert(data: { company_id: string; service_id: string; image_url: string }) {
    return this.prisma.evidence.upsert({
      where: { service_id: data.service_id },
      create: data,
      update: { image_url: data.image_url, registration_date: new Date() },
    });
  }
}
