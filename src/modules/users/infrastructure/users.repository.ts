import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { Role } from '../../../core/constants/roles.enum';
import { UserStatus } from '@prisma/client';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(company_id: string) {
    return this.prisma.user.findMany({
      where: { company_id },
      select: { id: true, name: true, email: true, role: true, status: true, created_at: true, permissions: true },
    });
  }

  findById(id: string, company_id: string) {
    return this.prisma.user.findFirst({
      where: { id, company_id },
      select: { id: true, name: true, email: true, role: true, status: true, created_at: true, permissions: true },
    });
  }

  findByEmail(email: string, company_id: string) {
    return this.prisma.user.findFirst({
      where: { email, company_id },
      select: { id: true, name: true, email: true, role: true, status: true, created_at: true, permissions: true },
    });
  }

  create(data: {
    company_id: string;
    name: string;
    email: string;
    password_hash: string;
    role: Role;
    permissions?: string[];
  }) {
    return this.prisma.user.create({
      data,
      select: { id: true, name: true, email: true, role: true, status: true, created_at: true, permissions: true },
    });
  }

  update(id: string, company_id: string, data: { name?: string; email?: string; role?: Role; status?: UserStatus; password_hash?: string; permissions?: string[] }) {
    return this.prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, status: true, created_at: true, permissions: true },
    });
  }

  delete(id: string, company_id: string) {
    return this.prisma.user.delete({ where: { id } });
  }
}
