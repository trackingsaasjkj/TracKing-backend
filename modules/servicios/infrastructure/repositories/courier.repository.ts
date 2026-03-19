import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../../src/infrastructure/database/prisma.service";

@Injectable()
export class CourierRepository {

  constructor(private prisma: PrismaService) {}

  async findById(id: string, companyId: string) {
    return this.prisma.courier.findFirst({
      where: {
        id,
        company_id: companyId
      }
    });
  }

  async updateStatus(id: string, companyId: string, status) {
    return this.prisma.courier.updateMany({
      where: {
        id,
        company_id: companyId
      },
      data: {
        operational_status: status
      }
    });
  }
}
