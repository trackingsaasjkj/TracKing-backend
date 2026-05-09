import { Module } from '@nestjs/common';
import { ReportesController } from './reportes.controller';
import { ReporteServiciosUseCase } from './application/use-cases/reporte-servicios.use-case';
import { ReporteFinancieroUseCase } from './application/use-cases/reporte-financiero.use-case';
import { ReporteFavoritosUseCase } from './application/use-cases/reporte-favoritos.use-case';
import { ReporteFinancieroHibridoUseCase } from './application/use-cases/reporte-financiero-hibrido.use-case';
import { ReportesRepository } from './infrastructure/reportes.repository';
import { ReportesHibridoRepository } from './infrastructure/reportes-hibrido.repository';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { CacheModule } from '../../infrastructure/cache/cache.module';

@Module({
  imports: [PrismaModule, CacheModule],
  controllers: [ReportesController],
  providers: [ReporteServiciosUseCase, ReporteFinancieroUseCase, ReporteFavoritosUseCase, ReporteFinancieroHibridoUseCase, ReportesRepository, ReportesHibridoRepository],
  exports: [ReporteServiciosUseCase, ReporteFinancieroUseCase, ReporteFavoritosUseCase, ReporteFinancieroHibridoUseCase],
})
export class ReportesModule {}
