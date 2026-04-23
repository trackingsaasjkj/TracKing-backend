import { Injectable } from '@nestjs/common';
import { ReporteFinancieroUseCase } from '../../../reportes/application/use-cases/reporte-financiero.use-case';
import { CacheService } from '../../../../infrastructure/cache/cache.service';

export interface DailyRevenue {
  day: string;   // 'Lun' | 'Mar' | ... | 'Dom'
  date: string;  // ISO date string YYYY-MM-DD
  total: number;
  isToday: boolean;
}

export interface BffWeeklyStatsResponse {
  weekly_revenue: DailyRevenue[];
}

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

@Injectable()
export class BffWeeklyStatsUseCase {
  constructor(
    private readonly reporteFinanciero: ReporteFinancieroUseCase,
    private readonly cache: CacheService,
  ) {}

  async execute(company_id: string): Promise<BffWeeklyStatsResponse> {
    const cacheKey = `bff:weekly-stats:${company_id}`;
    const cached = await this.cache.get<BffWeeklyStatsResponse>(cacheKey);
    if (cached !== null) return cached;

    const now = new Date();
    const todayStr = this.toDateStr(now);

    // Build last 7 days (today + 6 previous days), ordered Mon→Sun
    const days: { date: Date; label: string; dateStr: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      days.push({
        date: d,
        label: DAY_LABELS[d.getDay()],
        dateStr: this.toDateStr(d),
      });
    }

    // Fetch revenue for each day in parallel
    const revenues = await Promise.all(
      days.map(({ date, dateStr }) => {
        const from = `${dateStr}T00:00:00`;
        const to = `${dateStr}T23:59:59`;
        return this.reporteFinanciero
          .execute({ from, to }, company_id)
          .then(r => r.revenue.total_price)
          .catch(() => 0);
      }),
    );

    const weekly_revenue: DailyRevenue[] = days.map((d, i) => ({
      day: d.label,
      date: d.dateStr,
      total: revenues[i],
      isToday: d.dateStr === todayStr,
    }));

    const result: BffWeeklyStatsResponse = { weekly_revenue };
    await this.cache.set(cacheKey, result, 300); // 5 min cache
    return result;
  }

  private toDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
