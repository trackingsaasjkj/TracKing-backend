import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PlanesRepository } from '../../infrastructure/planes.repository';
import { CreatePlanDto } from '../dto/create-plan.dto';
import { UpdatePlanDto } from '../dto/update-plan.dto';

@Injectable()
export class PlanesUseCases {
  constructor(private readonly repo: PlanesRepository) {}

  findAll() {
    return this.repo.findAll();
  }

  async findById(id: string) {
    const plan = await this.repo.findById(id);
    if (!plan) throw new NotFoundException('Plan no encontrado');
    return plan;
  }

  async create(dto: CreatePlanDto) {
    const existing = await this.repo.findByName(dto.name);
    if (existing) throw new ConflictException('Ya existe un plan con ese nombre');
    return this.repo.create(dto);
  }

  async update(id: string, dto: UpdatePlanDto) {
    await this.findById(id);
    if (dto.name) {
      const existing = await this.repo.findByName(dto.name);
      if (existing && existing.id !== id) {
        throw new ConflictException('Ya existe un plan con ese nombre');
      }
    }
    return this.repo.update(id, dto);
  }

  async deactivate(id: string) {
    await this.findById(id);
    const activeCount = await this.repo.hasActiveSubscriptions(id);
    if (activeCount > 0) {
      throw new BadRequestException('No se puede desactivar un plan con suscripciones activas');
    }
    return this.repo.deactivate(id);
  }
}
