import { Module } from '@nestjs/common';
import { SuscripcionesAdminController, SuscripcionEmpresaController } from './suscripciones.controller';
import { SuscripcionesUseCases } from './application/use-cases/suscripciones.use-cases';
import { SuscripcionesRepository } from './infrastructure/suscripciones.repository';

@Module({
  controllers: [SuscripcionesAdminController, SuscripcionEmpresaController],
  providers: [SuscripcionesUseCases, SuscripcionesRepository],
  exports: [SuscripcionesRepository],
})
export class SuscripcionesModule {}
