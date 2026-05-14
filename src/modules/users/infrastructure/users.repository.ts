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

const companyProfileSelect = {
  id: true,
  name: true,
  nit: true,
  email_corporativo: true,
  telefono: true,
  direccion: true,
} as const;

const profileSelect = {
  ...userSelect,
  company_id: true,
  company: { select: companyProfileSelect },
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

  /** Perfil del usuario autenticado (incluye empresa si existe). */
  findProfileForMe(userId: string, company_id: string | null) {
    return this.prisma.user.findFirst({
      where:
        company_id !== null
          ? { id: userId, company_id }
          : { id: userId, company_id: null },
      select: profileSelect,
    });
  }

  /** Solo para verificar contraseña actual — no exponer en respuestas de API. */
  findByIdWithPassword(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, password_hash: true },
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

  update(
    id: string,
    company_id: string,
    data: {
      name?: string;
      email?: string;
      phone?: string | null;
      role?: Role;
      status?: UserStatus;
      password_hash?: string;
      permissions?: string[];
    },
  ) {
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
