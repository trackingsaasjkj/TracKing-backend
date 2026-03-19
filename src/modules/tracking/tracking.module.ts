import { Module } from '@nestjs/common';
import { TrackingController } from './tracking.controller';
import { RegistrarUbicacionUseCase } from './application/use-cases/registrar-ubicacion.use-case';
import { ConsultarUbicacionUseCase } from './application/use-cases/consultar-ubicacion.use-case';
import { LocationRepository } from './infrastructure/location.repository';
import { MensajerosModule } from '../mensajeros/mensajeros.module';

@Module({
  imports: [MensajerosModule], // re-uses exported MensajeroRepository + ConsultarMensajerosUseCase
  controllers: [TrackingController],
  providers: [
    RegistrarUbicacionUseCase,
    ConsultarUbicacionUseCase,
    LocationRepository,
  ],
})
export class TrackingModule {}
