import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
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

// Colombia = UTC-5 siempre (no tiene horario de verano)
const COLOMBIA_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Retorna la fecha local de Colombia como string YYYY-MM-DD para un Date UTC */
function toBogotaDateStr(utcDate: Date): string {
  const local = new Date(utcDate.getTime() - COLOMBIA_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, '0');
  const d = String(local.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Convierte una fecha YYYY-MM-DD Colombia a rango UTC [inicio, fin] del día */
function bogotaDayToUtcRange(dateStr: string): { from: Date; to: Date } {
  // Medianoche Colombia = 05:00 UTC
  const from = new Date(`${dateStr}T05:00:00.000Z`);
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { from, to };
}

@Injectable()
export class BffWeeklyStatsUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async execute(company_id: string): Promise<BffWeeklyStatsResponse> {
    const cacheKey = `bff:weekly-stats:${company_id}`;
    const cached = await this.cache.get<BffWeeklyStatsResponse>(cacheKey);
    if (cached !== null) return cached;

    const now = new Date();
    const todayStr = toBogotaDateStr(now);

    // Construir los últimos 7 días en hora Colombia
    const days: { label: string; dateStr: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = toBogotaDateStr(d);
      const dayOfWeek = new Date(`${dateStr}T12:00:00.000Z`).getUTCDay();
      days.push({ label: DAY_LABELS[dayOfWeek], dateStr });
    }

    // Query directa a Prisma — suma delivery_price de servicios DELIVERED por día
    const revenues = await Promise.all(
      days.map(async ({ dateStr }) => {
        const { from, to } = bogotaDayToUtcRange(dateStr);
        const result = await this.prisma.service.aggregate({
          where: {
            company_id,
            status: 'DELIVERED',
            delivery_date: { gte: from, lte: to },
          },
          _sum: { delivery_price: true },
        });
        return Number(result._sum.delivery_price ?? 0);
      }),
    );

    const weekly_revenue: DailyRevenue[] = days.map((d, i) => ({
      day: d.label,
      date: d.dateStr,
      total: revenues[i],
      isToday: d.dateStr === todayStr,
    }));

    const result: BffWeeklyStatsResponse = { weekly_revenue };
    await this.cache.set(cacheKey, result, 60); // caché de 1 minuto para datos frescos
    return result;
  }
}
