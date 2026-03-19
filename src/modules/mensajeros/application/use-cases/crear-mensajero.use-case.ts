import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { MensajeroRepository } from '../../infrastructure/mensajero.repository';
import { CreateMensajeroDto } from '../dto/create-mensajero.dto';

@Injectable()
export class CrearMensajeroUseCase {
  constructor(
    private readonly mensajeroRepo: MensajeroRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(dto: CreateMensajeroDto, company_id: string) {
    // User must exist and belong to same company
    const user = await this.prisma.user.findFirst({
      where: { id: dto.user_id, company_id },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado en esta empresa');

    // One courier profile per user
    const existing = await this.mensajeroRepo.findByUserId(dto.user_id, company_id);
    if (existing) throw new ConflictException('Este usuario ya tiene perfil de mensajero');

    return this.mensajeroRepo.create({ ...dto, company_id });
  }
}
