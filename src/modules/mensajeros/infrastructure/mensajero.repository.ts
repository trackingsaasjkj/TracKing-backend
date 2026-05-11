import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { CourierStatus, ServiceStatus } from '@prisma/client';
import { PaginatedResponse } from '../../../core/types/paginated-response.type';

@Injectable()
export class MensajeroRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getTodayRange() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    return { todayStart, todayEnd };
  }

  private withServicesCountToday<T extends { _count?: { services?: number } }>(courier: T) {
    const { _count, ...rest } = courier;
    return {
      ...rest,
      services_count_today: _count?.services ?? 0,
    };
  }

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
    const { todayStart, todayEnd } = this.getTodayRange();
    return this.prisma.courier.findMany({
      where: { company_id, operational_status: 'AVAILABLE' },
      include: {
        user: { select: { id: true, name: true, email: true } },
        _count: {
          select: {
            services: {
              where: {
                company_id,
                created_at: { gte: todayStart, lte: todayEnd },
                status: { not: 'CANCELLED' },
              },
            },
          },
        },
      },
    }).then(rows => rows.map(row => this.withServicesCountToday(row)));
  }

  async findAvailableAndInService(company_id: string) {
    const { todayStart, todayEnd } = this.getTodayRange();
    return this.prisma.courier.findMany({
      where: { company_id, operational_status: { in: ['AVAILABLE', 'IN_SERVICE'] } },
      include: {
        user: { select: { id: true, name: true, email: true } },
        _count: {
          select: {
            services: {
              where: {
                company_id,
                created_at: { gte: todayStart, lte: todayEnd },
                status: { not: 'CANCELLED' },
              },
            },
          },
        },
      },
    }).then(rows => rows.map(row => this.withServicesCountToday(row)));
  }

  async findAll(company_id: string) {
    const { todayStart, todayEnd } = this.getTodayRange();
    return this.prisma.courier.findMany({
      where: { company_id },
      include: {
        user: { select: { id: true, name: true, email: true, status: true } },
        _count: {
          select: {
            services: {
              where: {
                company_id,
                created_at: { gte: todayStart, lte: todayEnd },
                status: { not: 'CANCELLED' },
              },
            },
          },
        },
      },
    }).then(rows => rows.map(row => this.withServicesCountToday(row)));
  }

  async findAllPaginated(
    company_id: string,
    pagination: { page: number; limit: number },
  ): Promise<PaginatedResponse<Awaited<ReturnType<typeof this.prisma.courier.findFirst>>>> {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;
    const { todayStart, todayEnd } = this.getTodayRange();

    const [data, total] = await Promise.all([
      this.prisma.courier.findMany({
        where: { company_id },
        include: {
          user: { select: { id: true, name: true, email: true, status: true } },
          _count: {
            select: {
              services: {
                where: {
                  company_id,
                  created_at: { gte: todayStart, lte: todayEnd },
                  status: { not: 'CANCELLED' },
                },
              },
            },
          },
        },
        skip,
        take: limit,
      }),
      this.prisma.courier.count({ where: { company_id } }),
    ]);

    return { data: data.map(row => this.withServicesCountToday(row)), total, page, limit };
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
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const rows = await this.prisma.service.findMany({
      where: {
        courier_id,
        company_id,
        OR: [
          // Active services (all statuses except DELIVERED)
          { status: { not: 'DELIVERED' } },
          // Delivered services only from today
          { status: 'DELIVERED', delivery_date: { gte: todayStart, lte: todayEnd } },
        ],
      },
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

  async findMyServiceById(service_id: string, courier_id: string, company_id: string) {
    const row = await this.prisma.service.findFirst({
      where: { id: service_id, courier_id, company_id },
      include: { customer: { select: { id: true, name: true, phone: true } } },
    });
    if (!row) return null;
    return {
      ...row,
      delivery_price: Number(row.delivery_price),
      product_price: Number(row.product_price),
      total_price: Number(row.total_price),
    };
  }

  async findMyServicesPaginated(    courier_id: string,
    company_id: string,
    filters: { status?: ServiceStatus },
    pagination: { page: number; limit: number },
  ): Promise<PaginatedResponse<any>> {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;
    const where = {
      courier_id,
      company_id,
      ...(filters.status ? { status: filters.status } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        include: { customer: { select: { id: true, name: true, phone: true } } },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.service.count({ where }),
    ]);

    return {
      data: rows.map((s) => ({
        ...s,
        delivery_price: Number(s.delivery_price),
        product_price: Number(s.product_price),
        total_price: Number(s.total_price),
      })),
      total,
      page,
      limit,
    };
  }
}
