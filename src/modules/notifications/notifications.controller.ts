import { Body, Controller, Delete, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { NotificationsUseCases } from './application/use-cases/notifications.use-cases';
import { SendNotificationDto } from './application/dto/send-notification.dto';
import { RegisterTokenDto } from './application/dto/register-token.dto';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Role } from '../../core/constants/roles.enum';
import { JwtPayload } from '../../core/types/jwt-payload.type';
import { ok } from '../../core/utils/response.util';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@Controller('api/notifications')
@UseGuards(RolesGuard)
export class NotificationsController {
  constructor(private readonly useCases: NotificationsUseCases) {}

  @Post('fcm-token')
  @Roles(Role.COURIER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Registrar FCM token del mensajero',
    description: 'El mensajero registra su token FCM al iniciar sesión en la app móvil.',
  })
  @ApiResponse({ status: 200, description: 'Token registrado correctamente' })
  async registerToken(
    @Body() dto: RegisterTokenDto,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.useCases.registerToken(dto, user.sub, user.company_id!);
    return ok({ message: 'FCM token registrado' });
  }

  @Delete('fcm-token')
  @Roles(Role.COURIER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar FCM token (logout)',
    description: 'Elimina el token FCM del mensajero al cerrar sesión.',
  })
  @ApiResponse({ status: 200, description: 'Token eliminado' })
  async clearToken(@CurrentUser() user: JwtPayload) {
    await this.useCases.clearToken(user.sub, user.company_id!);
    return ok({ message: 'FCM token eliminado' });
  }

  @Post('send')
  @Roles(Role.ADMIN, Role.AUX)
  @ApiOperation({
    summary: 'Enviar notificación a un mensajero (ADMIN/AUX)',
    description: 'Envía una notificación push a un mensajero específico de la empresa.',
  })
  @ApiResponse({ status: 201, description: 'Notificación enviada' })
  @ApiResponse({ status: 404, description: 'Mensajero sin token registrado' })
  async sendToCourier(
    @Body() dto: SendNotificationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return ok(await this.useCases.sendToCourier(dto, user.company_id!));
  }
}
