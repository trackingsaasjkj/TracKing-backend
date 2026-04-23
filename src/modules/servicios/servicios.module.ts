import { Module } from '@nestjs/common';
import { ServiciosController } from './servicios.controller';
import { CrearServicioUseCase } from './application/use-cases/crear-servicio.use-case';
import { AsignarServicioUseCase } from './application/use-cases/asignar-servicio.use-case';
import { CambiarEstadoUseCase } from './application/use-cases/cambiar-estado.use-case';
import { CambiarPagoUseCase } from './application/use-cases/cambiar-pago.use-case';
import { CancelarServicioUseCase } from './application/use-cases/cancelar-servicio.use-case';
import { ConsultarServiciosUseCase } from './application/use-cases/consultar-servicios.use-case';
import { EditarServicioUseCase } from './application/use-cases/editar-servicio.use-case';
import { ServicioRepository } from './infrastructure/repositories/servicio.repository';
import { CourierRepository } from './infrastructure/repositories/courier.repository';
import { HistorialRepository } from './infrastructure/repositories/historial.repository';
import { EvidenceRepository } from './infrastructure/repositories/evidence.repository';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [ServiciosController],
  providers: [
    CrearServicioUseCase,
    AsignarServicioUseCase,
    CambiarEstadoUseCase,
    CambiarPagoUseCase,
    CancelarServicioUseCase,
    ConsultarServiciosUseCase,
    EditarServicioUseCase,
    ServicioRepository,
    CourierRepository,
    HistorialRepository,
    EvidenceRepository,
  ],
  exports: [ServicioRepository, CourierRepository, EvidenceRepository, HistorialRepository, ConsultarServiciosUseCase, CambiarPagoUseCase],
})
export class ServiciosModule {}
