import { Module } from '@nestjs/common';
import { LiquidacionesController } from './liquidaciones.controller';
import { GenerarLiquidacionCourierUseCase } from './application/use-cases/generar-liquidacion-courier.use-case';
import { GenerarLiquidacionClienteUseCase } from './application/use-cases/generar-liquidacion-cliente.use-case';
import { ConsultarLiquidacionesUseCase } from './application/use-cases/consultar-liquidaciones.use-case';
import { GestionarReglasUseCase } from './application/use-cases/gestionar-reglas.use-case';
import { LiquidacionRepository } from './infrastructure/liquidacion.repository';
import { MensajerosModule } from '../mensajeros/mensajeros.module';
import { PrismaModule } from '../../infrastructure/database/prisma.module';

@Module({
  imports: [PrismaModule, MensajerosModule],
  controllers: [LiquidacionesController],
  providers: [
    GenerarLiquidacionCourierUseCase,
    GenerarLiquidacionClienteUseCase,
    ConsultarLiquidacionesUseCase,
    GestionarReglasUseCase,
    LiquidacionRepository,
  ],
  exports: [ConsultarLiquidacionesUseCase, GestionarReglasUseCase, LiquidacionRepository],
})
export class LiquidacionesModule {}
