import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse, ApiBearerAuth,
  ApiParam, ApiQuery,
} from '@nestjs/swagger';
import { RegistrarUbicacionUseCase } from './application/use-cases/registrar-ubicacion.use-case';
import { ConsultarUbicacionUseCase } from './application/use-cases/consultar-ubicacion.use-case';
import { RegisterLocationDto } from './application/dto/register-location.dto';
import { ConsultarMensajerosUseCase } from '../mensajeros/application/use-cases/consultar-mensajeros.use-case';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Role } from '../../core/constants/roles.enum';
import { JwtPayload } from '../../core/types/jwt-payload.type';
import { ok } from '../../core/utils/response.util';

@ApiTags('Tracking')
@ApiBearerAuth('access-token')
@Controller('api/tracking')
@UseGuards(RolesGuard)
export class TrackingController {
  constructor(
    private readonly registrarUseCase: RegistrarUbicacionUseCase,
    private readonly consultarUseCase: ConsultarUbicacionUseCase,
    private readonly mensajerosUseCase: ConsultarMensajerosUseCase,
  ) {}

  /**
   * COURIER sends their own location.
   * courier_id is resolved from JWT — never from the body.
   */
  @Post('location')
  @Roles(Role.COURIER)
  @ApiOperation({
    summary: 'Registrar ubicación (COURIER)',
    description: 'El mensajero autenticado envía su posición. Solo permitido en estado IN_SERVICE. Frecuencia recomendada: cada 15 segundos.',
  })
  @ApiResponse({ status: 201, description: 'Ubicación registrada' })
  @ApiResponse({ status: 400, description: 'Mensajero no está IN_SERVICE' })
  @ApiResponse({ status: 404, description: 'Perfil de mensajero no encontrado' })
  async registrar(@Body() dto: RegisterLocationDto, @CurrentUser() user: JwtPayload) {
    const courier = await this.mensajerosUseCase.findCourierByUserId(user.sub, user.company_id!);
    return ok(await this.registrarUseCase.execute(dto, courier.id, user.company_id!));
  }

  /**
   * ADMIN / AUX query last known position of any courier in their company.
   */
  @Get(':courier_id/last')
  @Roles(Role.ADMIN, Role.AUX)
  @ApiOperation({ summary: 'Última ubicación del mensajero', description: 'Retorna el registro más reciente de ubicación.' })
  @ApiParam({ name: 'courier_id', description: 'UUID del mensajero' })
  @ApiResponse({ status: 200, description: 'Última ubicación' })
  @ApiResponse({ status: 404, description: 'Sin ubicación registrada o mensajero no encontrado' })
  async findLast(@Param('courier_id') courier_id: string, @CurrentUser() user: JwtPayload) {
    return ok(await this.consultarUseCase.findLast(courier_id, user.company_id!));
  }

  /**
   * ADMIN / AUX query location history with optional date range and limit.
   */
  @Get(':courier_id/history')
  @Roles(Role.ADMIN, Role.AUX)
  @ApiOperation({ summary: 'Historial de ubicaciones', description: 'Retorna hasta `limit` registros (default 100), ordenados del más reciente al más antiguo.' })
  @ApiParam({ name: 'courier_id', description: 'UUID del mensajero' })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'ISO date — ej: 2025-01-01T00:00:00Z' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'ISO date — ej: 2025-01-31T23:59:59Z' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Máximo de registros (default 100)' })
  @ApiResponse({ status: 200, description: 'Historial de ubicaciones' })
  async findHistory(
    @Param('courier_id') courier_id: string,
    @CurrentUser() user: JwtPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return ok(
      await this.consultarUseCase.findHistory(courier_id, user.company_id!, {
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
      }),
    );
  }
}
