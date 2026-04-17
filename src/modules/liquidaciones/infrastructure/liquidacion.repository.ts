import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { SettlementStatus } from '@prisma/client';

@Injectable()
export class LiquidacionRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── Settlement Rules ────────────────────────────────────────

  async findActiveRule(company_id: string) {
    return this.prisma.settlementRule.findFirst({
      where: { company_id, active: true },
      orderBy: { created_at: 'desc' },
    });
  }

  async findAllRules(company_id: string) {
    return this.prisma.settlementRule.findMany({ where: { company_id }, orderBy: { created_at: 'desc' } });
  }

  async createRule(data: { company_id: string; type: 'PERCENTAGE' | 'FIXED'; value: number }) {
    // Deactivate existing rules before creating new active one
    await this.prisma.settlementRule.updateMany({ where: { company_id: data.company_id, active: true }, data: { active: false } });
    return this.prisma.settlementRule.create({ data: { ...data, active: true } });
  }

  // ── Delivered services for settlement ──────────────────────

  async findDeliveredServices(company_id: string, courier_id: string, startDate: Date, endDate: Date) {
    const services = await this.prisma.service.findMany({
      where: {
        company_id,
        courier_id,
        status: 'DELIVERED',
        delivery_date: { gte: startDate, lte: endDate },
      },
      select: { id: true, delivery_price: true, product_price: true, total_price: true, delivery_date: true },
    });
    return services.map(s => ({
      ...s,
      delivery_price: Number(s.delivery_price),
      product_price: Number(s.product_price),
      total_price: Number(s.total_price),
    }));
  }

  async findDeliveredServicesAllCouriers(company_id: string, startDate: Date, endDate: Date) {
    const services = await this.prisma.service.findMany({
      where: {
        company_id,
        status: 'DELIVERED',
        delivery_date: { gte: startDate, lte: endDate },
      },
      select: { id: true, delivery_price: true, product_price: true, total_price: true, delivery_date: true },
    });
    return services.map(s => ({
      ...s,
      delivery_price: Number(s.delivery_price),
      product_price: Number(s.product_price),
      total_price: Number(s.total_price),
    }));
  }

  // ── Courier Settlement ──────────────────────────────────────

  async createCourierSettlement(data: {
    company_id: string;
    courier_id: string;
    start_date: Date;
    end_date: Date;
    total_services: number;
    total_earned: number;
    status?: 'SETTLED' | 'UNSETTLED';
  }) {
    return this.prisma.courierSettlement.create({ data: { ...data, status: data.status ?? 'SETTLED' } });
  }

  async findCourierSettlements(company_id: string, courier_id?: string) {
    return this.prisma.courierSettlement.findMany({
      where: { company_id, ...(courier_id && { courier_id }) },
      include: { courier: { include: { user: { select: { name: true, email: true } } } } },
      orderBy: { generation_date: 'desc' },
    });
  }

  async findCourierSettlementById(id: string, company_id: string) {
    return this.prisma.courierSettlement.findFirst({
      where: { id, company_id },
      include: { courier: { include: { user: { select: { name: true, email: true } } } } },
    });
  }

  // ── Customer Settlement ─────────────────────────────────────

  async findCustomerById(customer_id: string, company_id: string) {
    return this.prisma.customer.findFirst({ where: { id: customer_id, company_id } });
  }

  async findDeliveredServicesByCustomer(company_id: string, customer_id: string, startDate: Date, endDate: Date) {
    const services = await this.prisma.service.findMany({
      where: {
        company_id,
        customer_id,
        status: 'DELIVERED',
        delivery_date: { gte: startDate, lte: endDate },
      },
      select: { id: true, delivery_price: true, delivery_date: true },
    });
    return services.map(s => ({
      ...s,
      delivery_price: Number(s.delivery_price),
    }));
  }

  async createCustomerSettlement(data: {
    company_id: string;
    customer_id: string;
    start_date: Date;
    end_date: Date;
    total_services: number;
    total_invoiced: number;
  }) {
    return this.prisma.customerSettlement.create({
      data,
      include: { customer: { select: { id: true, name: true } } },
    });
  }

  async findCustomerSettlements(company_id: string, customer_id?: string) {
    return this.prisma.customerSettlement.findMany({
      where: { company_id, ...(customer_id && { customer_id }) },
      include: { customer: { select: { id: true, name: true } } },
      orderBy: { generation_date: 'desc' },
    });
  }

  // ── Mark services as settled ────────────────────────────────

  async markCourierServicesAsSettled(service_ids: string[], company_id: string) {
    return this.prisma.service.updateMany({
      where: { id: { in: service_ids }, company_id },
      data: { is_settled_courier: true },
    });
  }

  async markCustomerServicesAsSettled(service_ids: string[], company_id: string) {
    // Mark all as settled for customer
    await this.prisma.service.updateMany({
      where: { id: { in: service_ids }, company_id },
      data: { is_settled_customer: true },
    });
    // Also mark UNPAID ones as PAID
    await this.prisma.service.updateMany({
      where: { id: { in: service_ids }, company_id, payment_status: 'UNPAID' },
      data: { payment_status: 'PAID' },
    });
  }

  async markServicesAsPaid(service_ids: string[], company_id: string) {
    await this.prisma.service.updateMany({
      where: { id: { in: service_ids }, company_id },
      data: { is_settled_customer: true },
    });
    await this.prisma.service.updateMany({
      where: { id: { in: service_ids }, company_id, payment_status: 'UNPAID' },
      data: { payment_status: 'PAID' },
    });
  }

  async findServicesByIds(service_ids: string[], company_id: string) {
    return this.prisma.service.findMany({
      where: { id: { in: service_ids }, company_id },
      select: { id: true, customer_id: true, delivery_price: true, payment_status: true, is_settled_customer: true },
    });
  }

  // ── New query methods ───────────────────────────────────────

  async findPendingTodayCourier(company_id: string, courier_id: string) {
    // Find the oldest pending delivery date (earliest unsettled day)
    const oldest = await this.prisma.service.findFirst({
      where: {
        company_id,
        courier_id,
        status: 'DELIVERED',
        is_settled_courier: false,
        delivery_date: { not: null },
      },
      orderBy: { delivery_date: 'asc' },
      select: { delivery_date: true },
    });

    if (!oldest?.delivery_date) return [];

    // Build UTC day range from the date string to avoid timezone issues
    const d = oldest.delivery_date;
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const dayStart = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
    const dayEnd = new Date(`${yyyy}-${mm}-${dd}T23:59:59.999Z`);

    const services = await this.prisma.service.findMany({
      where: {
        company_id,
        courier_id,
        status: 'DELIVERED',
        is_settled_courier: false,
        delivery_date: { gte: dayStart, lte: dayEnd },
      },
      select: {
        id: true,
        delivery_date: true,
        payment_method: true,
        delivery_price: true,
        is_settled_courier: true,
        status: true,
        customer: { select: { id: true, name: true } },
      },
      orderBy: { delivery_date: 'asc' },
    });
    return services.map(s => ({
      ...s,
      delivery_price: Number(s.delivery_price),
    }));
  }

  async findCustomersWithUnpaid(company_id: string) {
    // Customers with at least one service not yet settled (is_settled_customer = false)
    const result = await this.prisma.service.groupBy({
      by: ['customer_id'],
      where: { company_id, is_settled_customer: false },
      _count: { id: true },
    });

    if (result.length === 0) return [];

    const customerIds = result.map(r => r.customer_id);
    const customers = await this.prisma.customer.findMany({
      where: { id: { in: customerIds }, company_id },
      select: { id: true, name: true },
    });

    return customers.map(c => ({
      ...c,
      unpaid_count: result.find(r => r.customer_id === c.id)?._count.id ?? 0,
    }));
  }

  async findUnpaidServicesByCustomer(
    company_id: string,
    customer_id: string,
    from?: Date,
    to?: Date,
  ) {
    // All unsettled services for the customer (is_settled_customer = false)
    const services = await this.prisma.service.findMany({
      where: {
        company_id,
        customer_id,
        is_settled_customer: false,
        ...(from || to
          ? {
              delivery_date: {
                ...(from && { gte: from }),
                ...(to && { lte: to }),
              },
            }
          : {}),
      },
      select: {
        id: true,
        delivery_date: true,
        payment_method: true,
        delivery_price: true,
        payment_status: true,
        is_settled_customer: true,
      },
      orderBy: { delivery_date: 'desc' },
    });
    return services.map(s => ({
      ...s,
      delivery_price: Number(s.delivery_price),
    }));
  }

  async countCouriersWithPendingToday(company_id: string): Promise<number> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const result = await this.prisma.service.groupBy({
      by: ['courier_id'],
      where: {
        company_id,
        status: 'DELIVERED',
        is_settled_courier: false,
        delivery_date: { gte: todayStart, lte: todayEnd },
        courier_id: { not: null },
      },
      _count: { id: true },
    });

    return result.length;
  }
}
