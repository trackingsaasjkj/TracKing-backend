import { Module } from '@nestjs/common';
import { MensajerosController } from './mensajeros.controller';
import { CrearMensajeroUseCase } from './application/use-cases/crear-mensajero.use-case';
import { ConsultarMensajerosUseCase } from './application/use-cases/consultar-mensajeros.use-case';
import { JornadaUseCase } from './application/use-cases/jornada.use-case';
import { UpdateMensajeroUseCase } from './application/use-cases/update-mensajero.use-case';
import { MensajeroRepository } from './infrastructure/mensajero.repository';

@Module({
  controllers: [MensajerosController],
  providers: [
    CrearMensajeroUseCase,
    ConsultarMensajerosUseCase,
    JornadaUseCase,
    UpdateMensajeroUseCase,
    MensajeroRepository,
  ],
  exports: [MensajeroRepository, ConsultarMensajerosUseCase],
})
export class MensajerosModule {}
