import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { Role } from '../../../core/constants/roles.enum';
import { UserStatus } from '@prisma/client';

const userSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  created_at: true,
  permissions: true,
} as const;

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(company_id: string) {
    return this.prisma.user.findMany({
      where: { company_id },
      select: userSelect,
    });
  }

  findById(id: string, company_id: string) {
    return this.prisma.user.findFirst({
      where: { id, company_id },
      select: userSelect,
    });
  }

  findByEmail(email: string, company_id: string) {
    return this.prisma.user.findFirst({
      where: { email, company_id },
      select: userSelect,
    });
  }

  create(data: {
    company_id: string;
    name: string;
    email: string;
    password_hash: string;
    role: Role;
    phone?: string;
    permissions?: string[];
  }) {
    return this.prisma.user.create({
      data,
      select: userSelect,
    });
  }

  update(id: string, company_id: string, data: { name?: string; email?: string; phone?: string; role?: Role; status?: UserStatus; password_hash?: string; permissions?: string[] }) {
    return this.prisma.user.update({
      where: { id },
      data,
      select: userSelect,
    });
  }

  delete(id: string, company_id: string) {
    return this.prisma.user.delete({ where: { id } });
  }
}
