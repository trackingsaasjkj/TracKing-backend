import { Module } from '@nestjs/common';
import { CourierMobileController } from './courier-mobile.controller';
import { MensajerosModule } from '../mensajeros/mensajeros.module';
import { ServiciosModule } from '../servicios/servicios.module';
import { EvidenciasModule } from '../evidencias/evidencias.module';
import { TrackingModule } from '../tracking/tracking.module';
import { CambiarEstadoUseCase } from '../servicios/application/use-cases/cambiar-estado.use-case';

@Module({
  imports: [
    MensajerosModule,   // ConsultarMensajerosUseCase, JornadaUseCase, MensajeroRepository
    ServiciosModule,    // ServicioRepository, CourierRepository, HistorialRepository, EvidenceRepository
    EvidenciasModule,   // SubirEvidenciaUseCase
    TrackingModule,     // RegistrarUbicacionUseCase
  ],
  controllers: [CourierMobileController],
  providers: [CambiarEstadoUseCase],
})
export class CourierMobileModule {}
