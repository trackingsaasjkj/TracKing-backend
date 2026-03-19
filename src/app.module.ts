import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { validate } from './config/env';
import { PrismaModule } from './infrastructure/database/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CompanyModule } from './modules/company/company.module';
import { ServiciosModule } from './modules/servicios/servicios.module';
import { MensajerosModule } from './modules/mensajeros/mensajeros.module';
import { EvidenciasModule } from './modules/evidencias/evidencias.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { LiquidacionesModule } from './modules/liquidaciones/liquidaciones.module';
import { ReportesModule } from './modules/reportes/reportes.module';
import { JwtAuthGuard } from './core/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CompanyModule,
    ServiciosModule,
    MensajerosModule,
    EvidenciasModule,
    TrackingModule,
    LiquidacionesModule,
    ReportesModule,
  ],
  providers: [
    // Apply JwtAuthGuard globally — routes opt-out with @Public()
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
