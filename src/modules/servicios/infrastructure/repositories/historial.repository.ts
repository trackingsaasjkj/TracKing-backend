import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { ServiceStatus } from '@prisma/client';

@Injectable()
export class HistorialRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    company_id: string;
    service_id: string;
    previous_status: ServiceStatus | null;
    new_status: ServiceStatus;
    user_id: string;
  }) {
    return this.prisma.serviceStatusHistory.create({ data });
  }

  async findByService(service_id: string, company_id: string) {
    return this.prisma.serviceStatusHistory.findMany({
      where: { service_id, company_id },
      orderBy: { change_date: 'desc' },
    });
  }
}
