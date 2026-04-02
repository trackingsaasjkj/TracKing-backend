import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { ServiceStatus } from '@prisma/client';

type ServiceRow = Awaited<ReturnType<PrismaService['service']['findFirst']>>;

function mapService<T extends ServiceRow>(s: T) {
  if (!s) return s;
  return {
    ...s,
    delivery_price: Number(s.delivery_price),
    product_price: Number(s.product_price),
    total_price: Number(s.total_price),
  };
}

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
    const s = await this.prisma.service.create({ data: { ...data, status: 'PENDING' } });
    return mapService(s);
  }

  async findById(id: string, company_id: string) {
    const s = await this.prisma.service.findFirst({
      where: { id, company_id },
      include: { customer: true, courier: { include: { user: true } }, statusHistory: { orderBy: { change_date: 'desc' } } },
    });
    return mapService(s);
  }

  async findAllByCompany(
    company_id: string,
    filters?: { status?: ServiceStatus; courier_id?: string },
    pagination?: { limit?: number; offset?: number },
  ) {
    const take = pagination?.limit ?? 50;
    const skip = pagination?.offset ?? 0;
    const rows = await this.prisma.service.findMany({
      where: { company_id, ...filters },
      include: { customer: true, courier: { include: { user: true } } },
      orderBy: { created_at: 'desc' },
      take,
      skip,
    });
    return rows.map(mapService);
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
