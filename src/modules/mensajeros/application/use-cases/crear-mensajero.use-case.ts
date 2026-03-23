import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { MensajeroRepository } from '../../infrastructure/mensajero.repository';
import { CreateMensajeroDto } from '../dto/create-mensajero.dto';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class CrearMensajeroUseCase {
  constructor(
    private readonly mensajeroRepo: MensajeroRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(dto: CreateMensajeroDto, company_id: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findFirst({ where: { email: dto.email, company_id } });
      if (existing) throw new ConflictException('El email ya está registrado en esta empresa');

      const password_hash = await bcrypt.hash(dto.password, 12);
      const user = await tx.user.create({
        data: { company_id, name: dto.name, email: dto.email, password_hash, role: UserRole.COURIER },
      });

      const courier = await tx.courier.create({
        data: { company_id, user_id: user.id, document_id: dto.document_id, phone: dto.phone },
        include: { user: { select: { id: true, name: true, email: true } } },
      });

      return courier;
    });
  }
}
