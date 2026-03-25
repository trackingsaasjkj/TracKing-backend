import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class SuscripcionesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.subscription.findMany({
      include: { plan: true, company: { select: { id: true, name: true } } },
      orderBy: { created_at: 'desc' },
    });
  }

  findById(id: string) {
    return this.prisma.subscription.findUnique({
      where: { id },
      include: { plan: true, company: { select: { id: true, name: true } } },
    });
  }

  findActiveByCompany(company_id: string) {
    return this.prisma.subscription.findFirst({
      where: { company_id, status: 'ACTIVE' },
      include: { plan: true },
    });
  }

  cancelActiveByCompany(company_id: string) {
    return this.prisma.subscription.updateMany({
      where: { company_id, status: 'ACTIVE' },
      data: { status: 'CANCELLED' },
    });
  }

  create(data: {
    company_id: string;
    plan_id: string;
    start_date: Date;
    end_date: Date;
  }) {
    return this.prisma.subscription.create({
      data,
      include: { plan: true },
    });
  }

  cancel(id: string) {
    return this.prisma.subscription.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: { plan: true },
    });
  }
}
