import { Injectable } from '@nestjs/common';
import { LiquidacionRepository } from '../../infrastructure/liquidacion.repository';
import { CreateRuleDto } from '../dto/create-rule.dto';

@Injectable()
export class GestionarReglasUseCase {
  constructor(private readonly liquidacionRepo: LiquidacionRepository) {}

  async create(dto: CreateRuleDto, company_id: string) {
    return this.liquidacionRepo.createRule({ ...dto, company_id });
  }

  async findAll(company_id: string) {
    return this.liquidacionRepo.findAllRules(company_id);
  }

  async findActive(company_id: string) {
    return this.liquidacionRepo.findActiveRule(company_id);
  }
}
