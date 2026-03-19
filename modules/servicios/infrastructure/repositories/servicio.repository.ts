import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../../src/infrastructure/database/prisma.service";

@Injectable()
export class ServicioRepository {

  constructor(private prisma: PrismaService) {}

  async create(data) {
    return this.prisma.service.create({
      data: {
        ...data,
        total_price: data.delivery_price + data.product_price
      }
    });
  }

  async findById(id: string, companyId: string) {
    return this.prisma.service.findFirst({
      where: {
        id,
        company_id: companyId
      }
    });
  }

  async update(id: string, companyId: string, data) {
    return this.prisma.service.updateMany({
      where: {
        id,
        company_id: companyId
      },
      data
    });
  }

  async findAllByCompany(companyId: string) {
    return this.prisma.service.findMany({
      where: {
        company_id: companyId
      },
      orderBy: {
        created_at: "desc"
      }
    });
  }

  async findByCourier(courierId: string, companyId: string) {
    return this.prisma.service.findMany({
      where: {
        courier_id: courierId,
        company_id: companyId
      }
    });
  }
}
