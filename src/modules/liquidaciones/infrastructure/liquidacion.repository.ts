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
    return this.prisma.service.findMany({
      where: {
        company_id,
        courier_id,
        status: 'DELIVERED',
        delivery_date: { gte: startDate, lte: endDate },
      },
      select: { id: true, delivery_price: true, product_price: true, total_price: true, delivery_date: true },
    });
  }

  async findDeliveredServicesAllCouriers(company_id: string, startDate: Date, endDate: Date) {
    return this.prisma.service.findMany({
      where: {
        company_id,
        status: 'DELIVERED',
        delivery_date: { gte: startDate, lte: endDate },
      },
      select: { id: true, delivery_price: true, product_price: true, total_price: true, delivery_date: true },
    });
  }

  // ── Courier Settlement ──────────────────────────────────────

  async createCourierSettlement(data: {
    company_id: string;
    courier_id: string;
    start_date: Date;
    end_date: Date;
    total_services: number;
    total_earned: number;
  }) {
    return this.prisma.courierSettlement.create({ data });
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

  async createCustomerSettlement(data: {
    company_id: string;
    start_date: Date;
    end_date: Date;
    total_services: number;
    total_invoiced: number;
  }) {
    return this.prisma.customerSettlement.create({ data });
  }

  async findCustomerSettlements(company_id: string) {
    return this.prisma.customerSettlement.findMany({
      where: { company_id },
      orderBy: { generation_date: 'desc' },
    });
  }
}
