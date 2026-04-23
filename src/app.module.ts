import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { validate } from './config/env';
import { PrismaModule } from './infrastructure/database/prisma.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { CacheModule } from './infrastructure/cache/cache.module';
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
import { HealthModule } from './modules/health/health.module';
import { CustomersModule } from './modules/customers/customers.module';
import { CourierMobileModule } from './modules/courier-mobile/courier-mobile.module';
import { SuperAdminModule } from './modules/super-admin/super-admin.module';
import { PlanesModule } from './modules/planes/planes.module';
import { SuscripcionesModule } from './modules/suscripciones/suscripciones.module';
import { BffWebModule } from './modules/bff-web/bff-web.module';
import { GeocodingModule } from './modules/geocoding/geocoding.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    ThrottlerModule.forRoot([
      { name: 'short',       ttl: 60_000, limit: 20 },   // 20 req/min por defecto
      { name: 'auth',        ttl: 60_000, limit: 10 },   // 10 req/min para auth
      { name: 'super-admin', ttl: 60_000, limit: 30 },   // 30 req/min para super-admin
    ]),
    PrismaModule,
    StorageModule,
    CacheModule,
    AuthModule,
    UsersModule,
    CompanyModule,
    ServiciosModule,
    MensajerosModule,
    EvidenciasModule,
    TrackingModule,
    LiquidacionesModule,
    ReportesModule,
    HealthModule,
    CustomersModule,
    CourierMobileModule,
    SuperAdminModule,
    PlanesModule,
    SuscripcionesModule,
    BffWebModule,
    GeocodingModule,
    NotificationsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
