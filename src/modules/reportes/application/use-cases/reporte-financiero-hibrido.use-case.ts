import { Injectable } from '@nestjs/common';
import { ReportesHibridoRepository } from '../../infrastructure/reportes-hibrido.repository';
import { CacheService } from '../../../../infrastructure/cache/cache.service';
import { AppException } from '../../../../core/errors/app.exception';
import { ReporteFinancieroHibridoQueryDto } from '../dto/reporte-financiero-hibrido.dto';

// ─── Tipos internos para las funciones puras ────────────────────────────────

type SettledInput = {
  total_services: number;
  total_collected: number;
  company_commission: number;
  courier_payment: number;
};

type PendingInput = {
  count: number;
  total_collected: number;
  estimated_commission: number;
  estimated_courier_payment: number;
};

type TotalData = {
  total_services: number;
  total_collected: number;
  company_commission: number;
  courier_payment: number;
};

type SummaryData = {
  settlement_rate: number;
  pending_amount: number;
};

// ─── Interfaz pública del resultado ─────────────────────────────────────────

export interface FinancialReportHibridoResult {
  period: { from: string; to: string };
  settled: {
    count: number;
    total_services: number;
    total_collected: number;
    company_commission: number;
    courier_payment: number;
    by_payment_method: { method: string; total: number; count: number }[];
  };
  pending: {
    count: number;
    total_collected: number;
    estimated_commission: number;
    estimated_courier_payment: number;
    by_payment_method: { method: string; total: number; count: number }[];
    services?: Array<{
      id: string;
      tracking_number: string;
      customer_name: string;
      delivery_price: number;
      payment_method: string;
      delivery_date: string;
    }>;
  };
  total: {
    total_services: number;
    total_collected: number;
    company_commission: number;
    courier_payment: number;
  };
  summary: {
    settlement_rate: number;
    pending_amount: number;
  };
}

// ─── Funciones puras de cálculo (Tarea 3) ───────────────────────────────────

/**
 * Calcula la comisión estimada y el pago al mensajero para los servicios pendientes.
 * Si no hay regla activa, la comisión es 0 y el mensajero recibe el total.
 */
export function calculateEstimatedCommission(
  totalPendingCollected: number,
  pendingCount: number,
  rule: { type: 'PERCENTAGE' | 'FIXED'; value: number } | null,
): { estimated_commission: number; estimated_courier_payment: number } {
  if (!rule) {
    return { estimated_commission: 0, estimated_courier_payment: totalPendingCollected };
  }
  const commission =
    rule.type === 'PERCENTAGE'
      ? totalPendingCollected * (rule.value / 100)
      : pendingCount * rule.value;
  return {
    estimated_commission: commission,
    estimated_courier_payment: totalPendingCollected - commission,
  };
}

/**
 * Consolida las ramas settled y pending en totales y resumen.
 * settlement_rate es el porcentaje del total ya liquidado, redondeado a 1 decimal.
 */
export function consolidate(
  settled: SettledInput,
  pending: PendingInput,
): { total: TotalData; summary: SummaryData } {
  const total: TotalData = {
    total_services: settled.total_services + pending.count,
    total_collected: settled.total_collected + pending.total_collected,
    company_commission: settled.company_commission + pending.estimated_commission,
    courier_payment: settled.courier_payment + pending.estimated_courier_payment,
  };
  const settlement_rate =
    total.total_collected > 0
      ? Math.round((settled.total_collected / total.total_collected) * 1000) / 10
      : 0;
  return {
    total,
    summary: {
      settlement_rate,
      pending_amount: total.total_collected - settled.total_collected,
    },
  };
}

// ─── Use Case (Tarea 4) ──────────────────────────────────────────────────────

@Injectable()
export class ReporteFinancieroHibridoUseCase {
  constructor(
    private readonly repo: ReportesHibridoRepository,
    private readonly cache: CacheService,
  ) {}

  async execute(
    query: ReporteFinancieroHibridoQueryDto,
    company_id: string,
  ): Promise<FinancialReportHibridoResult> {
    // Validar presencia de parámetros
    if (!query.from || !query.to) {
      throw new AppException(
        'Los parámetros from y to son obligatorios para el reporte financiero híbrido',
      );
    }

    const from = new Date(query.from);
    const to = new Date(query.to);

    // Validar rango
    if (from >= to) {
      throw new AppException('from debe ser anterior a to');
    }

    // Cache hit
    const cacheKey = `reporte:financiero:hybrid:${company_id}:${query.from}:${query.to}`;
    const cached = await this.cache.get<FinancialReportHibridoResult>(cacheKey);
    if (cached !== null) return cached;

    // Cache miss — ejecutar 6 queries en paralelo
    const [settledBranch, pendingBranch, settledByPayment, pendingByPayment, activeRule, pendingServices] =
      await Promise.all([
        this.repo.getSettledBranch(company_id, from, to),
        this.repo.getPendingBranch(company_id, from, to),
        this.repo.getSettledByPaymentMethod(company_id, from, to),
        this.repo.getPendingByPaymentMethod(company_id, from, to),
        this.repo.getActiveRule(company_id),
        this.repo.getPendingServices(company_id, from, to),
      ]);

    // Calcular comisión estimada para pendientes
    const commission = calculateEstimatedCommission(
      pendingBranch.total_collected,
      pendingBranch.count,
      activeRule,
    );

    // Consolidar totales y resumen
    const { total, summary } = consolidate(settledBranch, {
      count: pendingBranch.count,
      total_collected: pendingBranch.total_collected,
      ...commission,
    });

    const result: FinancialReportHibridoResult = {
      period: { from: query.from, to: query.to },
      settled: {
        count: settledBranch.count,
        total_services: settledBranch.total_services,
        total_collected: settledBranch.total_collected,
        company_commission: settledBranch.company_commission,
        courier_payment: settledBranch.courier_payment,
        by_payment_method: settledByPayment,
      },
      pending: {
        count: pendingBranch.count,
        total_collected: pendingBranch.total_collected,
        estimated_commission: commission.estimated_commission,
        estimated_courier_payment: commission.estimated_courier_payment,
        by_payment_method: pendingByPayment,
        services: pendingServices.map((s) => ({
          id: s.id,
          tracking_number: s.tracking_number,
          customer_name: s.customer_name,
          delivery_price: s.delivery_price,
          payment_method: s.payment_method,
          delivery_date: s.delivery_date.toISOString(),
        })),
      },
      total,
      summary,
    };

    await this.cache.set(cacheKey, result, 300);
    return result;
  }
}
