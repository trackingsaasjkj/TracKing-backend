import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class PlanesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.plan.findMany({ orderBy: { created_at: 'asc' } });
  }

  findById(id: string) {
    return this.prisma.plan.findUnique({ where: { id } });
  }

  findByName(name: string) {
    return this.prisma.plan.findUnique({ where: { name } });
  }

  create(data: {
    name: string;
    description?: string;
    max_couriers: number;
    max_services_per_month: number;
    max_users: number;
    price: number;
  }) {
    return this.prisma.plan.create({ data });
  }

  update(id: string, data: Partial<{
    name: string;
    description: string;
    max_couriers: number;
    max_services_per_month: number;
    max_users: number;
    price: number;
  }>) {
    return this.prisma.plan.update({ where: { id }, data });
  }

  deactivate(id: string) {
    return this.prisma.plan.update({ where: { id }, data: { active: false } });
  }

  hasActiveSubscriptions(id: string) {
    return this.prisma.subscription.count({
      where: { plan_id: id, status: 'ACTIVE' },
    });
  }
}
