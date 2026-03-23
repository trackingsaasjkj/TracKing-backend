import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class CustomersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(company_id: string) {
    return this.prisma.customer.findMany({
      where: { company_id, status: true },
      orderBy: { name: 'asc' },
    });
  }

  findById(id: string, company_id: string) {
    return this.prisma.customer.findFirst({ where: { id, company_id } });
  }

  create(data: { company_id: string; name: string; address: string; phone?: string; email?: string }) {
    return this.prisma.customer.create({ data });
  }

  update(id: string, company_id: string, data: { name?: string; address?: string; phone?: string; email?: string }) {
    return this.prisma.customer.updateMany({ where: { id, company_id }, data });
  }

  deactivate(id: string, company_id: string) {
    return this.prisma.customer.updateMany({ where: { id, company_id }, data: { status: false } });
  }
}
