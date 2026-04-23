import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsUseCases } from './application/use-cases/notifications.use-cases';
import { NotificationsRepository } from './infrastructure/notifications.repository';
import { FirebaseService } from './infrastructure/firebase.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsUseCases, NotificationsRepository, FirebaseService],
  // Exportamos UseCases para que otros módulos (servicios, liquidaciones) puedan enviar notificaciones
  exports: [NotificationsUseCases],
})
export class NotificationsModule {}
