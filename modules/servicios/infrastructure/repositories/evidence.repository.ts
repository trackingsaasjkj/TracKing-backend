import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../../src/infrastructure/database/prisma.service";

@Injectable()
export class EvidenceRepository {

  constructor(private prisma: PrismaService) {}

  async findByServiceId(serviceId: string, companyId: string) {
    return this.prisma.evidence.findFirst({
      where: {
        service_id: serviceId,
        company_id: companyId
      }
    });
  }

  async create(data) {
    return this.prisma.evidence.create({
      data
    });
  }
}
