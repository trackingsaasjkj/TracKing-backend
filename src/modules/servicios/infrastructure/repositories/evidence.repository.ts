import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

@Injectable()
export class EvidenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByServiceId(service_id: string, company_id: string) {
    return this.prisma.evidence.findFirst({ where: { service_id, company_id } });
  }

  async create(data: { company_id: string; service_id: string; image_url: string }) {
    return this.prisma.evidence.create({ data });
  }
}
