import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

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
}
