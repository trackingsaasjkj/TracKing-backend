import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../../../src/infrastructure/database/prisma.service";

@Injectable()
export class LiquidacionRepository {

  constructor(private prisma: PrismaService) {}

  async createCourierSettlement(data: any) {
    return this.prisma.courierSettlement.create({ data });
  }

  async findCourierSettlements(courierId: string, companyId: string) {
    return this.prisma.courierSettlement.findMany({
      where: { courier_id: courierId, company_id: companyId },
    });
  }

  async createCustomerSettlement(data: any) {
    return this.prisma.customerSettlement.create({ data });
  }
}
