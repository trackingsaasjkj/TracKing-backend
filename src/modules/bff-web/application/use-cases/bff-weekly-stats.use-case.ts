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

    // Get today's date in Colombia timezone (America/Bogota = UTC-5)
    const now = new Date();
    const bogotaFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' });
    const todayStr = bogotaFormatter.format(now); // YYYY-MM-DD in Bogota time

    // Build last 7 days using Bogota local dates
    const days: { label: string; dateStr: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      // Subtract i days from today in UTC, then format in Bogota time
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - i);
      const dateStr = bogotaFormatter.format(d);
      days.push({ label: DAY_LABELS[new Date(`${dateStr}T12:00:00`).getDay()], dateStr });
    }

    // Fetch revenue for each day using UTC-adjusted ranges (Bogota UTC-5: midnight = UTC 05:00)
    const revenues = await Promise.all(
      days.map(({ dateStr }) => {
        const from = `${dateStr}T05:00:00.000Z`;
        const toDate = new Date(`${dateStr}T05:00:00.000Z`);
        toDate.setUTCDate(toDate.getUTCDate() + 1);
        toDate.setUTCMilliseconds(toDate.getUTCMilliseconds() - 1);
        const to = toDate.toISOString();
        return this.reporteFinanciero
          .execute({ from, to }, company_id)
          .then(r => r.revenue.total_delivery)
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
    await this.cache.set(cacheKey, result, 300);
    return result;
  }

  private toDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
