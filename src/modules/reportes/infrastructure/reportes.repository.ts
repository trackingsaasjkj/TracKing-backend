import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class ReportesRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── Operational ─────────────────────────────────────────────

  /** Count services grouped by status, scoped to company + optional date range */
  async countByStatus(company_id: string, from?: Date, to?: Date) {
    return this.prisma.service.groupBy({
      by: ['status'],
      where: {
        company_id,
        ...(from || to ? { created_at: { ...(from && { gte: from }), ...(to && { lte: to }) } } : {}),
      },
      _count: { id: true },
    });
  }

  /** Count services per courier in range */
  async countByCourier(company_id: string, from?: Date, to?: Date, courier_id?: string) {
    return this.prisma.service.groupBy({
      by: ['courier_id'],
      where: {
        company_id,
        courier_id: courier_id ? courier_id : { not: null },
        ...(from || to ? { created_at: { ...(from && { gte: from }), ...(to && { lte: to }) } } : {}),
      },
      _count: { id: true },
    });
  }

  /** Fetch courier names for a list of courier ids */
  async findCourierNames(company_id: string, courierIds: string[]) {
    return this.prisma.courier.findMany({
      where: { company_id, id: { in: courierIds } },
      select: { id: true, user: { select: { name: true } } },
    });
  }

  /** Average delivery time in minutes: assignment_date → delivery_date */
  async avgDeliveryMinutes(company_id: string, from?: Date, to?: Date) {
    const rows = await this.prisma.service.findMany({
      where: {
        company_id,
        status: 'DELIVERED',
        assignment_date: { not: null },
        delivery_date: { not: null },
        ...(from || to ? { delivery_date: { ...(from && { gte: from }), ...(to && { lte: to }) } } : {}),
      },
      select: { assignment_date: true, delivery_date: true },
    });

    if (!rows.length) return null;

    const totalMs = rows.reduce((sum, r) => {
      return sum + (r.delivery_date!.getTime() - r.assignment_date!.getTime());
    }, 0);

    return Math.round(totalMs / rows.length / 60000); // ms → minutes
  }

  /** Cancellation rate: cancelled / total in range */
  async cancellationRate(company_id: string, from?: Date, to?: Date) {
    const dateFilter = from || to
      ? { created_at: { ...(from && { gte: from }), ...(to && { lte: to }) } }
      : {};

    const [total, cancelled] = await Promise.all([
      this.prisma.service.count({ where: { company_id, ...dateFilter } }),
      this.prisma.service.count({ where: { company_id, status: 'CANCELLED', ...dateFilter } }),
    ]);

    return { total, cancelled, rate: total > 0 ? Number(((cancelled / total) * 100).toFixed(2)) : 0 };
  }

  // ── Financial ───────────────────────────────────────────────

  /** Total revenue from delivered services in range */
  async totalRevenue(company_id: string, from: Date, to: Date) {
    const result = await this.prisma.service.aggregate({
      where: {
        company_id,
        status: 'DELIVERED',
        delivery_date: { gte: from, lte: to },
      },
      _sum: { total_price: true, delivery_price: true, product_price: true },
      _count: { id: true },
    });
    return result;
  }

  /** Revenue grouped by payment method */
  async revenueByPaymentMethod(company_id: string, from: Date, to: Date) {
    return this.prisma.service.groupBy({
      by: ['payment_method'],
      where: {
        company_id,
        status: 'DELIVERED',
        delivery_date: { gte: from, lte: to },
      },
      _sum: { total_price: true },
      _count: { id: true },
    });
  }

  /** Total settled vs unsettled courier settlements */
  async settlementSummary(company_id: string, from: Date, to: Date) {
    return this.prisma.courierSettlement.groupBy({
      by: ['status'],
      where: {
        company_id,
        generation_date: { gte: from, lte: to },
      },
      _sum: { total_earned: true },
      _count: { id: true },
    });
  }
}
