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

    const [totalRows, settledRows, settlementRows, courierSettlements] = await Promise.all([
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

      // Query 3: company_commission per courier from settlements in range
      this.prisma.courierSettlement.groupBy({
        by: ['courier_id'],
        where: {
          company_id,
          ...(courier_id ? { courier_id } : {}),
          ...settlementDateFilter,
        },
        _sum: { company_commission: true },
      }),

      // Query 4: courier_payment and company_commission from settlements
      this.prisma.courierSettlement.groupBy({
        by: ['courier_id'],
        where: {
          company_id,
          ...(courier_id ? { courier_id } : {}),
          ...settlementDateFilter,
        },
        _sum: { courier_payment: true, company_commission: true },
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
      settlementRows.map((r) => [r.courier_id, Number(r._sum.company_commission ?? 0)]),
    );

    const settlementPaymentMap = new Map(
      courierSettlements.map((r) => [
        r.courier_id,
        {
          courier_payment: Number(r._sum.courier_payment ?? 0),
          company_commission: Number(r._sum.company_commission ?? 0),
        },
      ]),
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

        // Use settlement data for total_amount and company_earnings
        const settlementPayment = settlementPaymentMap.get(r.courier_id);
        const total_facturado = settlementPayment?.courier_payment ?? 0;
        const company_earnings = settlementPayment?.company_commission ?? 0;

        return {
          courier_id: r.courier_id,
          courier_name: nameMap.get(r.courier_id) ?? '',
          total_services,
          settled_services,
          unsettled_services,
          total_amount: total_facturado,
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

  /** Total revenue from delivered services in range — based on delivery_price only */
  async totalRevenue(company_id: string, from: Date, to: Date) {
    const result = await this.prisma.service.aggregate({
      where: {
        company_id,
        status: 'DELIVERED',
        created_at: { gte: from, lte: to },
      },
      _sum: { delivery_price: true },
      _count: { id: true },
    });
    return result;
  }

  /** Revenue grouped by payment method — based on delivery_price only */
  async revenueByPaymentMethod(company_id: string, from: Date, to: Date) {
    return this.prisma.service.groupBy({
      by: ['payment_method'],
      where: {
        company_id,
        status: 'DELIVERED',
        created_at: { gte: from, lte: to },
      },
      _sum: { delivery_price: true },
      _count: { id: true },
    });
  }

  /** Total settled vs unsettled courier settlements with service counts */
  async settlementSummary(company_id: string, from: Date, to: Date) {
    return this.prisma.courierSettlement.groupBy({
      by: ['status'],
      where: {
        company_id,
        generation_date: { gte: from, lte: to },
      },
      _sum: { company_commission: true, total_services: true },
      _count: { id: true },
    });
  }

  /** Count services pending settlement (is_settled_courier = false) */
  async countPendingSettlement(company_id: string, from: Date, to: Date) {
    return this.prisma.service.count({
      where: {
        company_id,
        status: 'DELIVERED',
        is_settled_courier: false,
        created_at: { gte: from, lte: to },
      },
    });
  }

  /**
   * Returns favorite customer report for the given company and optional date range.
   * Only includes customers with is_favorite = true.
   * Executes queries in parallel and crosses results in memory.
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

    // Step 1: get all favorite customer ids for this company
    const favoriteCustomers = await this.prisma.customer.findMany({
      where: {
        company_id,
        is_favorite: true,
        ...(customer_id ? { id: customer_id } : {}),
      },
      select: { id: true, name: true },
    });

    if (favoriteCustomers.length === 0) return [];

    const favoriteIds = favoriteCustomers.map((c) => c.id);
    const nameMap = new Map(favoriteCustomers.map((c) => [c.id, c.name]));

    const [totalRows, paidRows] = await Promise.all([
      // Query 1: total_services + total_amount (all services of favorite customers)
      this.prisma.service.groupBy({
        by: ['customer_id'],
        where: {
          company_id,
          customer_id: { in: favoriteIds },
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
          customer_id: { in: favoriteIds },
          payment_status: 'PAID',
          ...dateFilter,
        },
        _count: { id: true },
        _sum: { delivery_price: true },
      }),
    ]);

    // Build lookup map for paid rows
    const paidMap = new Map(
      paidRows.map((r) => [
        r.customer_id,
        { count: r._count?.id ?? 0, amount: Number(r._sum?.delivery_price ?? 0) },
      ]),
    );

    // Build result — include all favorite customers, even those with 0 services
    return favoriteCustomers.map((customer) => {
      const totalRow = totalRows.find((r) => r.customer_id === customer.id);
      const total_services = totalRow?._count?.id ?? 0;
      const total_amount = Number(totalRow?._sum?.delivery_price ?? 0);

      const paid = paidMap.get(customer.id);
      const paid_services = paid?.count ?? 0;
      const paid_amount = paid?.amount ?? 0;

      return {
        customer_id: customer.id,
        customer_name: nameMap.get(customer.id) ?? '',
        total_services,
        total_amount,
        paid_services,
        paid_amount,
        unpaid_services: total_services - paid_services,
        unpaid_amount: total_amount - paid_amount,
      };
    });
  }
}
