import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServiciosController } from './servicios.controller';
import { CrearServicioUseCase } from './application/use-cases/crear-servicio.use-case';
import { AsignarServicioUseCase } from './application/use-cases/asignar-servicio.use-case';
import { AutoAsignarServicioUseCase } from './application/use-cases/auto-asignar-servicio.use-case';
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
import { ParseMessageUseCase } from './application/use-cases/parse-message.use-case';
import { ServiceUpdatesGateway } from './services-updates.gateway';
import { DashboardUpdatesGateway } from './dashboard-updates.gateway';

@Module({
  imports: [
    NotificationsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [ServiciosController],
  providers: [
    CrearServicioUseCase,
    AsignarServicioUseCase,
    AutoAsignarServicioUseCase,
    CambiarEstadoUseCase,
    CambiarPagoUseCase,
    CancelarServicioUseCase,
    ConsultarServiciosUseCase,
    EditarServicioUseCase,
    ServicioRepository,
    CourierRepository,
    HistorialRepository,
    EvidenceRepository,
    ServiceUpdatesGateway,
    DashboardUpdatesGateway,
    ParseMessageUseCase,
  ],
  exports: [ServicioRepository, CourierRepository, EvidenceRepository, HistorialRepository, ConsultarServiciosUseCase, CambiarPagoUseCase, ServiceUpdatesGateway, DashboardUpdatesGateway],
})
export class ServiciosModule {}
