import { Module } from '@nestjs/common';
import { ReportesController } from './reportes.controller';
import { ReporteServiciosUseCase } from './application/use-cases/reporte-servicios.use-case';
import { ReporteFinancieroUseCase } from './application/use-cases/reporte-financiero.use-case';
import { ReporteFavoritosUseCase } from './application/use-cases/reporte-favoritos.use-case';
import { ReportesRepository } from './infrastructure/reportes.repository';
import { PrismaModule } from '../../infrastructure/database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ReportesController],
  providers: [ReporteServiciosUseCase, ReporteFinancieroUseCase, ReporteFavoritosUseCase, ReportesRepository],
  exports: [ReporteServiciosUseCase, ReporteFinancieroUseCase, ReporteFavoritosUseCase],
})
export class ReportesModule {}
