import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export interface CourierStatsRow {
  courier_id: string;
  courier_name: string;
  total_services: number;       // DELIVERED
  settled_services: number;     // DELIVERED + is_settled_courier=true
  unsettled_services: number;   // DELIVERED + is_settled_courier=false
  total_amount: number;         // Σ delivery_price de DELIVERED
  company_earnings: number;     // Σ delivery_price(settled) - Σ total_earned(settlements)
}

export interface FavoriteCustomerReportItem {
  customer_id: string;
  customer_name: string;
  total_services: number;
  total_amount: number;
  paid_services: number;
  paid_amount: number;
  unpaid_services: number;
  unpaid_amount: number;
}

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

  /**
   * Returns enriched courier stats for the given company and optional date range.
   * Executes three Prisma queries in parallel and crosses results in memory.
   */
  async getCourierStats(
    company_id: string,
    from?: Date,
    to?: Date,
    courier_id?: string,
  ): Promise<CourierStatsRow[]> {
    const dateFilter =
      from || to
        ? { created_at: { ...(from && { gte: from }), ...(to && { lte: to }) } }
        : {};

    const settlementDateFilter =
      from || to
        ? { generation_date: { ...(from && { gte: from }), ...(to && { lte: to }) } }
        : {};

    const courierFilter = courier_id ? courier_id : { not: null as unknown as string };

    const [totalRows, settledRows, settlementRows] = await Promise.all([
      // Query 1: total_services + total_amount (DELIVERED)
      this.prisma.service.groupBy({
        by: ['courier_id'],
        where: {
          company_id,
          status: 'DELIVERED',
          courier_id: courierFilter,
          ...dateFilter,
        },
        _count: { id: true },
        _sum: { delivery_price: true },
      }),

      // Query 2: settled_services + settled_amount (DELIVERED + is_settled_courier=true)
      this.prisma.service.groupBy({
        by: ['courier_id'],
        where: {
          company_id,
          status: 'DELIVERED',
          is_settled_courier: true,
          courier_id: courierFilter,
          ...dateFilter,
        },
        _count: { id: true },
        _sum: { delivery_price: true },
      }),

      // Query 3: total_earned per courier from settlements in range
      this.prisma.courierSettlement.groupBy({
        by: ['courier_id'],
        where: {
          company_id,
          ...(courier_id ? { courier_id } : {}),
          ...settlementDateFilter,
        },
        _sum: { total_earned: true },
      }),
    ]);

    // Build lookup maps for O(n) cross-join
    const settledMap = new Map(
      settledRows.map((r) => [
        r.courier_id,
        { count: r._count.id, amount: Number(r._sum.delivery_price ?? 0) },
      ]),
    );

    const settlementMap = new Map(
      settlementRows.map((r) => [r.courier_id, Number(r._sum.total_earned ?? 0)]),
    );

    // Collect all courier ids from total rows
    const courierIds = totalRows
      .map((r) => r.courier_id)
      .filter((id): id is string => id !== null);

    // Fetch courier names
    const couriers = await this.findCourierNames(company_id, courierIds);
    const nameMap = new Map(couriers.map((c) => [c.id, c.user.name]));

    // Cross results in memory
    return totalRows
      .filter((r): r is typeof r & { courier_id: string } => r.courier_id !== null)
      .map((r) => {
        const total_services = r._count.id;
        const total_amount = Number(r._sum.delivery_price ?? 0);

        const settled = settledMap.get(r.courier_id);
        const settled_services = settled?.count ?? 0;
        const settled_amount = settled?.amount ?? 0;

        const unsettled_services = total_services - settled_services;

        const total_earned = settlementMap.get(r.courier_id) ?? 0;
        const company_earnings = settled_amount - total_earned;

        return {
          courier_id: r.courier_id,
          courier_name: nameMap.get(r.courier_id) ?? '',
          total_services,
          settled_services,
          unsettled_services,
          total_amount,
          company_earnings,
        };
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

  /**
   * Returns favorite customer report for the given company and optional date range.
   * Executes three Prisma queries in parallel and crosses results in memory.
   * When customer_id is provided, filters to that customer (only if is_favorite=true).
   */
  async getFavoriteCustomersReport(
    company_id: string,
    from?: Date,
    to?: Date,
    customer_id?: string,
  ): Promise<FavoriteCustomerReportItem[]> {
    const dateFilter =
      from || to
        ? { created_at: { ...(from && { gte: from }), ...(to && { lte: to }) } }
        : {};

    const customerFilter = customer_id ? { customer_id } : {};

    const [totalRows, paidRows] = await Promise.all([
      // Query 1: total_services + total_amount (all services of favorite customers)
      this.prisma.service.groupBy({
        by: ['customer_id'],
        where: {
          company_id,
          customer: { is_favorite: true },
          ...customerFilter,
          ...dateFilter,
        },
        _count: { id: true },
        _sum: { delivery_price: true },
      }),

      // Query 2: paid_services + paid_amount (payment_status = PAID)
      this.prisma.service.groupBy({
        by: ['customer_id'],
        where: {
          company_id,
          customer: { is_favorite: true },
          payment_status: 'PAID',
          ...customerFilter,
          ...dateFilter,
        },
        _count: { id: true },
        _sum: { delivery_price: true },
      }),
    ]);

    // Collect customer ids from total rows to fetch names
    const customerIds = totalRows
      .map((r) => r.customer_id)
      .filter((id): id is string => id !== null);

    // Query 3: customer names (only for customers that appear in results)
    const customers = await this.prisma.customer.findMany({
      where: {
        company_id,
        is_favorite: true,
        id: { in: customerIds },
      },
      select: { id: true, name: true },
    });

    // Build lookup maps for O(n) cross-join
    const paidMap = new Map(
      paidRows.map((r) => [
        r.customer_id,
        { count: r._count.id, amount: Number(r._sum.delivery_price ?? 0) },
      ]),
    );

    const nameMap = new Map(customers.map((c) => [c.id, c.name]));

    // Cross results in memory
    return totalRows
      .filter((r): r is typeof r & { customer_id: string } => r.customer_id !== null)
      .map((r) => {
        const total_services = r._count.id;
        const total_amount = Number(r._sum.delivery_price ?? 0);

        const paid = paidMap.get(r.customer_id);
        const paid_services = paid?.count ?? 0;
        const paid_amount = paid?.amount ?? 0;

        const unpaid_services = total_services - paid_services;
        const unpaid_amount = total_amount - paid_amount;

        return {
          customer_id: r.customer_id,
          customer_name: nameMap.get(r.customer_id) ?? '',
          total_services,
          total_amount,
          paid_services,
          paid_amount,
          unpaid_services,
          unpaid_amount,
        };
      });
  }
}
