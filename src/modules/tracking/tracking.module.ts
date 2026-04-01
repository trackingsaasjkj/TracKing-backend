import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TrackingController } from './tracking.controller';
import { TrackingGateway } from './tracking.gateway';
import { RegistrarUbicacionUseCase } from './application/use-cases/registrar-ubicacion.use-case';
import { ConsultarUbicacionUseCase } from './application/use-cases/consultar-ubicacion.use-case';
import { LocationRepository } from './infrastructure/location.repository';
import { MensajerosModule } from '../mensajeros/mensajeros.module';

@Module({
  imports: [
    MensajerosModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [TrackingController],
  providers: [
    TrackingGateway,
    RegistrarUbicacionUseCase,
    ConsultarUbicacionUseCase,
    LocationRepository,
  ],
  exports: [RegistrarUbicacionUseCase],
})
export class TrackingModule {}
