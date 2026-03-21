import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { ServiceStatus } from '@prisma/client';

@Injectable()
export class ServicioRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    company_id: string;
    customer_id: string;
    payment_method: string;
    origin_address: string;
    origin_apartment_office?: string;
    origin_contact_phone: string;
    destination_address: string;
    destination_apartment_office?: string;
    destination_contact_number: string;
    destination_name: string;
    package_details: string;
    delivery_price: number;
    product_price: number;
    total_price: number;
    notes_observations?: string;
  }) {
    return this.prisma.service.create({ data: { ...data, status: 'PENDING' } });
  }

  async findById(id: string, company_id: string) {
    return this.prisma.service.findFirst({
      where: { id, company_id },
      include: { customer: true, courier: true, statusHistory: { orderBy: { change_date: 'desc' } } },
    });
  }

  async findAllByCompany(
    company_id: string,
    filters?: { status?: ServiceStatus; courier_id?: string },
    pagination?: { limit?: number; offset?: number },
  ) {
    const take = pagination?.limit ?? 50;
    const skip = pagination?.offset ?? 0;
    return this.prisma.service.findMany({
      where: { company_id, ...filters },
      include: { customer: true, courier: true },
      orderBy: { created_at: 'desc' },
      take,
      skip,
    });
  }

  async update(id: string, company_id: string, data: Partial<{
    status: ServiceStatus;
    courier_id: string;
    assignment_date: Date;
    delivery_date: Date;
  }>) {
    return this.prisma.service.updateMany({ where: { id, company_id }, data });
  }
}
