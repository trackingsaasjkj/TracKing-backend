import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class LocationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    company_id: string;
    courier_id: string;
    latitude: number;
    longitude: number;
    accuracy?: number;
  }) {
    return this.prisma.courierLocation.create({ data });
  }

  /** Last known position — uses idx_location_company_courier_date */
  async findLast(courier_id: string, company_id: string) {
    return this.prisma.courierLocation.findFirst({
      where: { courier_id, company_id },
      orderBy: { registration_date: 'desc' },
    });
  }

  /** Paginated history for a courier within an optional date range */
  async findHistory(
    courier_id: string,
    company_id: string,
    opts?: { from?: Date; to?: Date; limit?: number },
  ) {
    const { from, to, limit = 100 } = opts ?? {};
    return this.prisma.courierLocation.findMany({
      where: {
        courier_id,
        company_id,
        ...(from || to
          ? { registration_date: { ...(from && { gte: from }), ...(to && { lte: to }) } }
          : {}),
      },
      orderBy: { registration_date: 'desc' },
      take: limit,
    });
  }
}
