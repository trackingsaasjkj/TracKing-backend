import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../../src/infrastructure/database/prisma.service";

@Injectable()
export class HistorialRepository {

  constructor(private prisma: PrismaService) {}

  async create(data: any) {
    return this.prisma.serviceStatusHistory.create({ data });
  }

  async findByService(serviceId: string, companyId: string) {
    return this.prisma.serviceStatusHistory.findMany({
      where: { service_id: serviceId, company_id: companyId },
      orderBy: { change_date: "desc" },
    });
  }
}
