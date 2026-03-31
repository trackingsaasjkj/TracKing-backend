import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { CourierStatus } from '@prisma/client';

@Injectable()
export class MensajeroRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, company_id: string) {
    return this.prisma.courier.findFirst({
      where: { id, company_id },
      include: { user: { select: { id: true, name: true, email: true, status: true } } },
    });
  }

  async findByUserId(user_id: string, company_id: string) {
    return this.prisma.courier.findFirst({
      where: { user_id, company_id },
      include: { user: { select: { id: true, name: true, email: true, status: true } } },
    });
  }

  async findAllActive(company_id: string) {
    return this.prisma.courier.findMany({
      where: { company_id, operational_status: 'AVAILABLE' },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  async findAll(company_id: string) {
    return this.prisma.courier.findMany({
      where: { company_id },
      include: { user: { select: { id: true, name: true, email: true, status: true } } },
    });
  }

  async create(data: {
    company_id: string;
    user_id: string;
    document_id?: string;
    phone?: string;
  }) {
    return this.prisma.courier.create({
      data,
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  async update(id: string, company_id: string, data: { document_id?: string; phone?: string }) {
    return this.prisma.courier.updateMany({ where: { id, company_id }, data });
  }

  async updateStatus(id: string, company_id: string, status: CourierStatus) {
    return this.prisma.courier.updateMany({
      where: { id, company_id },
      data: { operational_status: status },
    });
  }

  async countActiveServices(courier_id: string, company_id: string): Promise<number> {
    return this.prisma.service.count({
      where: {
        courier_id,
        company_id,
        status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_TRANSIT'] },
      },
    });
  }

  async findMyServices(courier_id: string, company_id: string) {
    const rows = await this.prisma.service.findMany({
      where: { courier_id, company_id },
      include: { customer: true },
      orderBy: { created_at: 'desc' },
    });
    return rows.map((s) => ({
      ...s,
      delivery_price: Number(s.delivery_price),
      product_price: Number(s.product_price),
      total_price: Number(s.total_price),
    }));
  }
}
