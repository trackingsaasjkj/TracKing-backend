import { Module } from '@nestjs/common';
import { BffWebController } from './bff-web.controller';
import { BffDashboardUseCase } from './application/use-cases/bff-dashboard.use-case';
import { BffActiveOrdersUseCase } from './application/use-cases/bff-active-orders.use-case';
import { BffReportsUseCase } from './application/use-cases/bff-reports.use-case';
import { BffSettlementsUseCase } from './application/use-cases/bff-settlements.use-case';
import { BffLiquidacionesUseCase } from './application/use-cases/bff-liquidaciones.use-case';
import { ServiciosModule } from '../servicios/servicios.module';
import { MensajerosModule } from '../mensajeros/mensajeros.module';
import { ReportesModule } from '../reportes/reportes.module';
import { LiquidacionesModule } from '../liquidaciones/liquidaciones.module';

@Module({
  imports: [ServiciosModule, MensajerosModule, ReportesModule, LiquidacionesModule],
  controllers: [BffWebController],
  providers: [
    BffDashboardUseCase,
    BffActiveOrdersUseCase,
    BffReportsUseCase,
    BffSettlementsUseCase,
    BffLiquidacionesUseCase,
  ],
})
export class BffWebModule {}
