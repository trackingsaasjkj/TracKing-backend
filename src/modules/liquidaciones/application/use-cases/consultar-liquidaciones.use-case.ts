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
    
    // Formatear los datos para serialización JSON
    return {
      ...settlement,
      total_collected: typeof settlement.total_collected === 'object' 
        ? Number(settlement.total_collected.toString()) 
        : settlement.total_collected,
      company_commission: typeof settlement.company_commission === 'object' 
        ? Number(settlement.company_commission.toString()) 
        : settlement.company_commission,
      courier_payment: typeof settlement.courier_payment === 'object' 
        ? Number(settlement.courier_payment.toString()) 
        : settlement.courier_payment,
      services: settlement.services.map(ss => ({
        id: ss.service.id,
        delivery_price: typeof ss.service.delivery_price === 'object'
          ? Number(ss.service.delivery_price.toString())
          : ss.service.delivery_price,
        product_price: typeof ss.service.product_price === 'object'
          ? Number(ss.service.product_price.toString())
          : ss.service.product_price,
        delivery_date: ss.service.delivery_date,
        customer: ss.service.customer,
      }))
    };
  }

  async findCustomerSettlements(company_id: string, customer_id?: string) {
    return this.liquidacionRepo.findCustomerSettlements(company_id, customer_id);
  }

  /** Earnings summary: total payment to courier across all settlements */
  async getEarnings(company_id: string, courier_id?: string) {
    const settlements = await this.liquidacionRepo.findCourierSettlements(company_id, courier_id);
    // Sumar courier_payment de cada settlement, convirtiendo Decimal a número
    const courierPayment = settlements.reduce((sum, s) => {
      const payment = typeof s.courier_payment === 'object' 
        ? Number(s.courier_payment.toString()) 
        : Number(s.courier_payment || 0);
      return sum + payment;
    }, 0);
    const totalServices = settlements.reduce((sum, s) => sum + s.total_services, 0);
    
    // Convertir settlements para serialización JSON
    const settlementsFormatted = settlements.map(s => ({
      ...s,
      total_collected: typeof s.total_collected === 'object' ? Number(s.total_collected.toString()) : s.total_collected,
      company_commission: typeof s.company_commission === 'object' ? Number(s.company_commission.toString()) : s.company_commission,
      courier_payment: typeof s.courier_payment === 'object' ? Number(s.courier_payment.toString()) : s.courier_payment,
    }));
    
    return {
      total_settlements: settlements.length,
      total_services: totalServices,
      courier_payment: courierPayment,
      settlements: settlementsFormatted,
    };
  }
}
