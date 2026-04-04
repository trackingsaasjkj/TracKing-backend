import { Module } from '@nestjs/common';
import { CourierMobileController } from './courier-mobile.controller';
import { MensajerosModule } from '../mensajeros/mensajeros.module';
import { ServiciosModule } from '../servicios/servicios.module';
import { EvidenciasModule } from '../evidencias/evidencias.module';
import { TrackingModule } from '../tracking/tracking.module';
import { CambiarEstadoUseCase } from '../servicios/application/use-cases/cambiar-estado.use-case';
import { CambiarPagoUseCase } from '../servicios/application/use-cases/cambiar-pago.use-case';

@Module({
  imports: [
    MensajerosModule,
    ServiciosModule,
    EvidenciasModule,
    TrackingModule,
  ],
  controllers: [CourierMobileController],
  providers: [CambiarEstadoUseCase, CambiarPagoUseCase],
})
export class CourierMobileModule {}
