import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { CourierStatus } from '@prisma/client';

@Injectable()
export class CourierRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, company_id: string) {
    return this.prisma.courier.findFirst({ where: { id, company_id } });
  }

  async updateStatus(id: string, company_id: string, status: CourierStatus) {
    return this.prisma.courier.updateMany({ where: { id, company_id }, data: { operational_status: status } });
  }
}
