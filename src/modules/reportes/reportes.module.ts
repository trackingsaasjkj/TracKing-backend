import { Module } from '@nestjs/common';
import { ReportesController } from './reportes.controller';
import { ReporteServiciosUseCase } from './application/use-cases/reporte-servicios.use-case';
import { ReporteFinancieroUseCase } from './application/use-cases/reporte-financiero.use-case';
import { ReportesRepository } from './infrastructure/reportes.repository';
import { PrismaModule } from '../../infrastructure/database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ReportesController],
  providers: [ReporteServiciosUseCase, ReporteFinancieroUseCase, ReportesRepository],
  exports: [ReporteServiciosUseCase, ReporteFinancieroUseCase],
})
export class ReportesModule {}
