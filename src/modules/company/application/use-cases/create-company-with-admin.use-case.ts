import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { CreateCompanyWithAdminDto } from '../dto/create-company-with-admin.dto';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class CreateCompanyWithAdminUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: CreateCompanyWithAdminDto) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Crear empresa
      const company = await tx.company.create({
        data: { name: dto.company.name },
      });

      // 2. Verificar email único dentro de la empresa (por si acaso)
      const existing = await tx.user.findUnique({
        where: { company_id_email: { company_id: company.id, email: dto.admin.email } },
      });
      if (existing) throw new ConflictException('El email ya está registrado');

      // 3. Crear usuario ADMIN asociado a la empresa
      const password_hash = await bcrypt.hash(dto.admin.password, 12);
      const user = await tx.user.create({
        data: {
          company_id: company.id,
          name: dto.admin.name,
          email: dto.admin.email,
          password_hash,
          role: UserRole.ADMIN,
        },
      });

      return {
        company: {
          id: company.id,
          name: company.name,
          status: company.status,
          created_at: company.created_at,
        },
        admin: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          company_id: user.company_id,
          created_at: user.created_at,
        },
      };
    });
  }
}
