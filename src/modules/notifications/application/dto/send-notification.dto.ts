import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum NotificationType {
  NEW_SERVICE = 'new_service',
  SERVICE_UPDATE = 'service_update',
  SETTLEMENT_READY = 'settlement_ready',
  GENERAL = 'general',
}

export class SendNotificationDto {
  @ApiProperty({ description: 'ID del mensajero (courier) destinatario' })
  @IsString()
  @IsNotEmpty()
  courierId!: string;

  @ApiProperty({ example: 'Nuevo servicio asignado', description: 'Título de la notificación' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ example: 'Tienes un nuevo servicio en Calle 10 #5-20', description: 'Cuerpo del mensaje' })
  @IsString()
  @IsNotEmpty()
  body!: string;

  @ApiProperty({ enum: NotificationType, description: 'Tipo de notificación para navegación en la app' })
  @IsEnum(NotificationType)
  type!: NotificationType;

  @ApiPropertyOptional({ description: 'Datos adicionales para la notificación (ej: serviceId)' })
  @IsOptional()
  @IsObject()
  data?: Record<string, string>;
}
