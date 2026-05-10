import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { CacheService } from '../../../../infrastructure/cache/cache.service';

export type RevenueChartRange = '1D' | '7D' | '1M';
export type RevenueChartMode = 'total' | 'commission';

export interface ChartDataPoint {
  label: string;   // display label for X axis
  date: string;    // YYYY-MM-DD (Colombia)
  total: number;
  isToday: boolean;
}

export interface BffRevenueChartResponse {
  data: ChartDataPoint[];
  grand_total: number;
  range: RevenueChartRange;
  mode: RevenueChartMode;
}

// Colombia = UTC-5 (no DST)
const COL_OFFSET_MS = 5 * 60 * 60 * 1000;

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function toBogotaDateStr(utcDate: Date): string {
  const local = new Date(utcDate.getTime() - COL_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, '0');
  const d = String(local.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function bogotaDayToUtcRange(dateStr: string): { from: Date; to: Date } {
  const from = new Date(`${dateStr}T05:00:00.000Z`);
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { from, to };
}

@Injectable()
export class BffRevenueChartUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async execute(
    company_id: string,
    range: RevenueChartRange,
    mode: RevenueChartMode,
  ): Promise<BffRevenueChartResponse> {
    const cacheKey = `bff:revenue-chart:${company_id}:${range}:${mode}`;
    const cached = await this.cache.get<BffRevenueChartResponse>(cacheKey);
    if (cached !== null) return cached;

    const now = new Date();
    const todayStr = toBogotaDateStr(now);

    let points: ChartDataPoint[];

    if (range === '1D') {
      // 24 hourly buckets for today (Colombia time)
      points = await this.buildHourlyPoints(company_id, todayStr, mode);
    } else if (range === '7D') {
      // Last 7 days
      points = await this.buildDailyPoints(company_id, 7, mode, now, todayStr);
    } else {
      // Last 30 days
      points = await this.buildDailyPoints(company_id, 30, mode, now, todayStr);
    }

    const grand_total = points.reduce((s, p) => s + p.total, 0);
    const result: BffRevenueChartResponse = { data: points, grand_total, range, mode };

    // Cache: 1 min for 1D (live-ish), 5 min for 7D/1M
    await this.cache.set(cacheKey, result, range === '1D' ? 60 : 300);
    return result;
  }

  // ── Hourly (1D) ────────────────────────────────────────────────────────────

  private async buildHourlyPoints(
    company_id: string,
    todayStr: string,
    mode: RevenueChartMode,
  ): Promise<ChartDataPoint[]> {
    // Today in Colombia: 00:00 COL = 05:00 UTC
    const dayStart = new Date(`${todayStr}T05:00:00.000Z`);

    const points: ChartDataPoint[] = [];

    for (let h = 0; h < 24; h++) {
      const from = new Date(dayStart.getTime() + h * 3600_000);
      const to = new Date(from.getTime() + 3600_000 - 1);
      const total = await this.queryAmount(company_id, from, to, mode);

      // Display as "0h", "6h", "12h", "18h" — only label every 6 hours to avoid clutter
      const label = h % 6 === 0 ? `${h}h` : '';
      points.push({ label, date: todayStr, total, isToday: true });
    }

    return points;
  }

  // ── Daily (7D / 1M) ────────────────────────────────────────────────────────

  private async buildDailyPoints(
    company_id: string,
    days: number,
    mode: RevenueChartMode,
    now: Date,
    todayStr: string,
  ): Promise<ChartDataPoint[]> {
    const dayList: { label: string; dateStr: string }[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = toBogotaDateStr(d);
      const dow = new Date(`${dateStr}T12:00:00.000Z`).getUTCDay();

      let label: string;
      if (days <= 7) {
        label = DAY_LABELS[dow];
      } else {
        // For 30 days: show day number, but only label every 5 days to avoid clutter
        const dayNum = parseInt(dateStr.split('-')[2], 10);
        label = dayNum % 5 === 1 || i === 0 ? String(dayNum) : '';
      }

      dayList.push({ label, dateStr });
    }

    const totals = await Promise.all(
      dayList.map(async ({ dateStr }) => {
        const { from, to } = bogotaDayToUtcRange(dateStr);
        return this.queryAmount(company_id, from, to, mode);
      }),
    );

    return dayList.map((d, i) => ({
      label: d.label,
      date: d.dateStr,
      total: totals[i],
      isToday: d.dateStr === todayStr,
    }));
  }

  // ── Query helpers ──────────────────────────────────────────────────────────

  private async queryAmount(
    company_id: string,
    from: Date,
    to: Date,
    mode: RevenueChartMode,
  ): Promise<number> {
    if (mode === 'total') {
      // Sum of delivery_price for DELIVERED services in the period
      const result = await this.prisma.service.aggregate({
        where: { company_id, status: 'DELIVERED', delivery_date: { gte: from, lte: to } },
        _sum: { delivery_price: true },
      });
      return Number(result._sum.delivery_price ?? 0);
    } else {
      // Sum of company_commission from courier settlements generated in the period
      const result = await this.prisma.courierSettlement.aggregate({
        where: { company_id, generation_date: { gte: from, lte: to } },
        _sum: { company_commission: true },
      });
      return Number(result._sum.company_commission ?? 0);
    }
  }
}
