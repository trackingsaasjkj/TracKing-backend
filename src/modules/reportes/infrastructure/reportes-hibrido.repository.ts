import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export interface SettledBranchResult {
  count: number;
  total_services: number;
  total_collected: number;
  company_commission: number;
  courier_payment: number;
}

export interface PendingBranchResult {
  count: number;
  total_collected: number;
}

export interface PaymentMethodBreakdownRow {
  method: string;
  total: number;
  count: number;
}

@Injectable()
export class ReportesHibridoRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Agrega liquidaciones SETTLED en el rango por generation_date.
   * Retorna ceros si no hay registros.
   */
  async getSettledBranch(
    company_id: string,
    from: Date,
    to: Date,
  ): Promise<SettledBranchResult> {
    const result = await this.prisma.courierSettlement.aggregate({
      where: {
        company_id,
        status: 'SETTLED',
        generation_date: { gte: from, lte: to },
      },
      _sum: {
        total_services: true,
        total_collected: true,
        company_commission: true,
        courier_payment: true,
      },
      _count: { id: true },
    });

    return {
      count: result._count.id,
      total_services: result._sum.total_services ?? 0,
      total_collected: Number(result._sum.total_collected ?? 0),
      company_commission: Number(result._sum.company_commission ?? 0),
      courier_payment: Number(result._sum.courier_payment ?? 0),
    };
  }

  /**
   * Agrega servicios DELIVERED + is_settled_courier=false en el rango por delivery_date.
   * Retorna ceros si no hay registros.
   */
  async getPendingBranch(
    company_id: string,
    from: Date,
    to: Date,
  ): Promise<PendingBranchResult> {
    const result = await this.prisma.service.aggregate({
      where: {
        company_id,
        status: 'DELIVERED',
        is_settled_courier: false,
        delivery_date: { gte: from, lte: to },
      },
      _sum: { delivery_price: true },
      _count: { id: true },
    });

    return {
      count: result._count.id,
      total_collected: Number(result._sum.delivery_price ?? 0),
    };
  }

  /**
   * JOIN CourierSettlement → SettlementService → Service, GROUP BY payment_method (solo SETTLED).
   * Usa raw query para el JOIN triple con agrupación.
   */
  async getSettledByPaymentMethod(
    company_id: string,
    from: Date,
    to: Date,
  ): Promise<PaymentMethodBreakdownRow[]> {
    const rows = await this.prisma.$queryRaw<
      { payment_method: string; total: unknown; count: unknown }[]
    >(
      Prisma.sql`
        SELECT s.payment_method, SUM(s.delivery_price) as total, COUNT(s.id) as count
        FROM courier_settlement cs
        JOIN settlement_service ss ON ss.settlement_id = cs.id
        JOIN service s ON s.id = ss.service_id
        WHERE cs.company_id = ${company_id}
          AND cs.status = 'SETTLED'
          AND cs.generation_date >= ${from}
          AND cs.generation_date <= ${to}
        GROUP BY s.payment_method
      `,
    );

    return rows.map((row) => ({
      method: row.payment_method,
      total: Number(row.total),
      count: Number(row.count),
    }));
  }

  /**
   * GROUP BY payment_method en Service DELIVERED + is_settled_courier=false.
   */
  async getPendingByPaymentMethod(
    company_id: string,
    from: Date,
    to: Date,
  ): Promise<PaymentMethodBreakdownRow[]> {
    const rows = await this.prisma.service.groupBy({
      by: ['payment_method'],
      where: {
        company_id,
        status: 'DELIVERED',
        is_settled_courier: false,
        delivery_date: { gte: from, lte: to },
      },
      _sum: { delivery_price: true },
      _count: { id: true },
    });

    return rows.map((row) => ({
      method: row.payment_method,
      total: Number(row._sum.delivery_price ?? 0),
      count: row._count.id,
    }));
  }

  /**
   * Retorna la SettlementRule activa para la empresa, o null si no existe.
   */
  async getActiveRule(
    company_id: string,
  ): Promise<{ type: 'PERCENTAGE' | 'FIXED'; value: number } | null> {
    const rule = await this.prisma.settlementRule.findFirst({
      where: { company_id, active: true },
      select: { type: true, value: true },
    });

    if (!rule) return null;

    return {
      type: rule.type as 'PERCENTAGE' | 'FIXED',
      value: Number(rule.value),
    };
  }

  /**
   * Retorna los servicios pendientes de liquidación con detalles.
   */
  async getPendingServices(
    company_id: string,
    from: Date,
    to: Date,
  ): Promise<
    Array<{
      id: string;
      tracking_number: string;
      customer_name: string;
      delivery_price: number;
      payment_method: string;
      delivery_date: Date;
    }>
  > {
    const services = await this.prisma.service.findMany({
      where: {
        company_id,
        status: 'DELIVERED',
        is_settled_courier: false,
        delivery_date: { gte: from, lte: to },
      },
      select: {
        id: true,
        delivery_price: true,
        payment_method: true,
        delivery_date: true,
        customer: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { delivery_date: 'desc' },
      take: 100, // Limit to 100 services for performance
    });

    return services
      .filter((s) => s.delivery_date !== null)
      .map((s) => ({
        id: s.id,
        tracking_number: s.id.substring(0, 8).toUpperCase(),
        customer_name: s.customer?.name || 'Sin cliente',
        delivery_price: Number(s.delivery_price),
        payment_method: s.payment_method,
        delivery_date: s.delivery_date as Date,
      }));
  }
}
