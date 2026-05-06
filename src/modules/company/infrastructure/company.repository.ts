import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AutoAssignMode } from '@prisma/client';

@Injectable()
export class CompanyRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(name: string) {
    return this.prisma.company.create({ data: { name } });
  }

  findById(id: string) {
    return this.prisma.company.findUnique({ where: { id } });
  }

  findAll() {
    return this.prisma.company.findMany({ where: { status: true } });
  }

  getAutoAssignMode(company_id: string) {
    return this.prisma.company.findUnique({
      where: { id: company_id },
      select: { auto_assign_mode: true },
    });
  }

  updateAutoAssignMode(company_id: string, mode: AutoAssignMode | null) {
    return this.prisma.company.update({
      where: { id: company_id },
      data: { auto_assign_mode: mode },
      select: { id: true, auto_assign_mode: true },
    });
  }
}
