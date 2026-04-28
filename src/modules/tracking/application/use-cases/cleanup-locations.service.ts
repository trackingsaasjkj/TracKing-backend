import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

/**
 * Removes courier_location records older than 48 hours.
 * Runs every day at 03:00 AM to keep the table lean.
 *
 * Impact: ~130 MB/month saved on the free Supabase tier.
 */
@Injectable()
export class CleanupLocationsService {
  private readonly logger = new Logger(CleanupLocationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanOldLocations(): Promise<void> {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago

    try {
      const { count } = await this.prisma.courierLocation.deleteMany({
        where: { registration_date: { lt: cutoff } },
      });

      if (count > 0) {
        this.logger.log(`Cleanup: deleted ${count} courier_location records older than 48h`);
      }
    } catch (err) {
      this.logger.error('Cleanup failed for courier_location', err);
    }
  }
}
