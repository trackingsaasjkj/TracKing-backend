import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { PaymentMethod, PaymentStatus, ServiceStatus } from '@prisma/client';
import { PaginatedResponse } from '../../../../core/types/paginated-response.type';

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

const SERVICE_TABLE_SELECT = {
  id: true,
  company_id: true,
  customer_id: true,
  courier_id: true,
  payment_method: true,
  payment_status: true,
  origin_address: true,
  origin_apartment_office: true,
  origin_contact_phone: true,
  destination_address: true,
  destination_apartment_office: true,
  destination_contact_number: true,
  destination_name: true,
  package_details: true,
  delivery_price: true,
  product_price: true,
  total_price: true,
  status: true,
  assignment_date: true,
  delivery_date: true,
  created_at: true,
  is_settled_courier: true,
  is_settled_customer: true,
  settle_immediately: true,
  customer: { select: { id: true, name: true, phone: true } },
  courier: { select: { id: true, user: { select: { id: true, name: true } } } },
} as const;

@Injectable()
export class ServicioRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    company_id: string;
    customer_id: string;
    payment_method: PaymentMethod;
    payment_status: PaymentStatus;
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
    settle_immediately?: boolean;
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

  async findAllByCompanyPaginated(
    company_id: string,
    filters: { status?: ServiceStatus; courier_id?: string },
    pagination: { page: number; limit: number },
  ): Promise<PaginatedResponse<ReturnType<typeof mapService>>> {
    const { page, limit } = pagination;
    const take = limit;
    const skip = (page - 1) * limit;
    const where = { company_id, ...filters };

    const [rows, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        select: SERVICE_TABLE_SELECT,
        orderBy: { created_at: 'desc' },
        take,
        skip,
      }),
      this.prisma.service.count({ where }),
    ]);

    return {
      data: rows.map((r) => mapService(r as any)),
      total,
      page,
      limit,
    };
  }

  async update(id: string, company_id: string, data: Partial<{
    status: ServiceStatus;
    courier_id: string;
    assignment_date: Date;
    delivery_date: Date;
    payment_method: PaymentMethod;
    payment_status: PaymentStatus;
    is_settled_courier: boolean;
    is_settled_customer: boolean;
  }>) {
    return this.prisma.service.updateMany({ where: { id, company_id }, data });
  }
}
