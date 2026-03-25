import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { SuscripcionesRepository } from '../../infrastructure/suscripciones.repository';
import { CreateSuscripcionDto } from '../dto/create-suscripcion.dto';

@Injectable()
export class SuscripcionesUseCases {
  constructor(
    private readonly repo: SuscripcionesRepository,
    private readonly prisma: PrismaService,
  ) {}

  findAll() {
    return this.repo.findAll();
  }

  async findById(id: string) {
    const sub = await this.repo.findById(id);
    if (!sub) throw new NotFoundException('Suscripción no encontrada');
    return sub;
  }

  async findActiveByCompany(company_id: string) {
    const sub = await this.repo.findActiveByCompany(company_id);
    if (!sub) throw new NotFoundException('No hay suscripción activa para esta empresa');
    return sub;
  }

  async create(dto: CreateSuscripcionDto) {
    // Validate company exists
    const company = await this.prisma.company.findUnique({ where: { id: dto.company_id } });
    if (!company) throw new NotFoundException('Empresa no encontrada');

    // Validate plan exists and is active
    const plan = await this.prisma.plan.findUnique({ where: { id: dto.plan_id } });
    if (!plan) throw new NotFoundException('Plan no encontrado');
    if (!plan.active) throw new BadRequestException('El plan seleccionado no está activo');

    const startDate = new Date(dto.start_date);

    // Compute end_date: provided or default start + 1 month
    let endDate: Date;
    if (dto.end_date) {
      endDate = new Date(dto.end_date);
      if (endDate <= startDate) {
        throw new BadRequestException('end_date debe ser posterior a start_date');
      }
    } else {
      endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
    }

    // Cancel any existing active subscription for this company, then create new one atomically
    return this.prisma.$transaction(async () => {
      await this.repo.cancelActiveByCompany(dto.company_id);
      return this.repo.create({
        company_id: dto.company_id,
        plan_id: dto.plan_id,
        start_date: startDate,
        end_date: endDate,
      });
    });
  }

  async cancel(id: string) {
    const sub = await this.findById(id);
    if (sub.status !== 'ACTIVE') {
      throw new BadRequestException('Solo se pueden cancelar suscripciones activas');
    }
    return this.repo.cancel(id);
  }
}
