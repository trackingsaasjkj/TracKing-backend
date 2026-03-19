import { Injectable, NotFoundException } from '@nestjs/common';
import { LiquidacionRepository } from '../../infrastructure/liquidacion.repository';

@Injectable()
export class ConsultarLiquidacionesUseCase {
  constructor(private readonly liquidacionRepo: LiquidacionRepository) {}

  async findCourierSettlements(company_id: string, courier_id?: string) {
    return this.liquidacionRepo.findCourierSettlements(company_id, courier_id);
  }

  async findCourierSettlementById(id: string, company_id: string) {
    const settlement = await this.liquidacionRepo.findCourierSettlementById(id, company_id);
    if (!settlement) throw new NotFoundException('Liquidación no encontrada');
    return settlement;
  }

  async findCustomerSettlements(company_id: string) {
    return this.liquidacionRepo.findCustomerSettlements(company_id);
  }

  /** Earnings summary: total earned across all courier settlements for the company */
  async getEarnings(company_id: string, courier_id?: string) {
    const settlements = await this.liquidacionRepo.findCourierSettlements(company_id, courier_id);
    const totalEarned = settlements.reduce((sum, s) => sum + Number(s.total_earned), 0);
    const totalServices = settlements.reduce((sum, s) => sum + s.total_services, 0);
    return {
      total_settlements: settlements.length,
      total_services: totalServices,
      total_earned: totalEarned,
      settlements,
    };
  }
}
