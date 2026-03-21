import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CrearServicioUseCase } from './application/use-cases/crear-servicio.use-case';
import { AsignarServicioUseCase } from './application/use-cases/asignar-servicio.use-case';
import { CambiarEstadoUseCase } from './application/use-cases/cambiar-estado.use-case';
import { CancelarServicioUseCase } from './application/use-cases/cancelar-servicio.use-case';
import { ConsultarServiciosUseCase } from './application/use-cases/consultar-servicios.use-case';
import { CrearServicioDto } from './application/dto/crear-servicio.dto';
import { AsignarServicioDto } from './application/dto/asignar-servicio.dto';
import { CambiarEstadoDto } from './application/dto/cambiar-estado.dto';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Role } from '../../core/constants/roles.enum';
import { JwtPayload } from '../../core/types/jwt-payload.type';
import { ok } from '../../core/utils/response.util';
import { ServiceStatus } from '@prisma/client';

@ApiTags('Services')
@ApiBearerAuth('access-token')
@Controller('api/services')
@UseGuards(RolesGuard)
export class ServiciosController {
  constructor(
    private readonly crearUseCase: CrearServicioUseCase,
    private readonly asignarUseCase: AsignarServicioUseCase,
    private readonly cambiarEstadoUseCase: CambiarEstadoUseCase,
    private readonly cancelarUseCase: CancelarServicioUseCase,
    private readonly consultarUseCase: ConsultarServiciosUseCase,
  ) {}

  @Post()
  @Roles(Role.ADMIN, Role.AUX)
  @ApiOperation({ summary: 'Crear servicio', description: 'Crea un nuevo servicio en estado PENDING. total_price = delivery_price + product_price.' })
  @ApiResponse({ status: 201, description: 'Servicio creado' })
  @ApiResponse({ status: 400, description: 'Error de validación de precios o cliente no encontrado' })
  async crear(@Body() dto: CrearServicioDto, @CurrentUser() user: JwtPayload) {
    return ok(await this.crearUseCase.execute(dto, user.company_id!, user.sub));
  }

  @Post(':id/assign')
  @Roles(Role.ADMIN, Role.AUX)
  @ApiOperation({ summary: 'Asignar mensajero', description: 'Transición PENDING → ASSIGNED. El mensajero debe estar AVAILABLE.' })
  @ApiParam({ name: 'id', description: 'UUID del servicio' })
  @ApiResponse({ status: 200, description: 'Servicio asignado' })
  @ApiResponse({ status: 400, description: 'Mensajero no disponible o transición inválida' })
  async asignar(@Param('id') id: string, @Body() dto: AsignarServicioDto, @CurrentUser() user: JwtPayload) {
    return ok(await this.asignarUseCase.execute(id, dto, user.company_id!, user.sub));
  }

  @Post(':id/status')
  @Roles(Role.ADMIN, Role.AUX, Role.COURIER)
  @ApiOperation({
    summary: 'Cambiar estado',
    description: 'Transiciones válidas: ASSIGNED→ACCEPTED, ACCEPTED→IN_TRANSIT, IN_TRANSIT→DELIVERED (requiere evidencia previa).',
  })
  @ApiParam({ name: 'id', description: 'UUID del servicio' })
  @ApiResponse({ status: 200, description: 'Estado actualizado' })
  @ApiResponse({ status: 400, description: 'Transición inválida o falta evidencia para DELIVERED' })
  async cambiarEstado(@Param('id') id: string, @Body() dto: CambiarEstadoDto, @CurrentUser() user: JwtPayload) {
    return ok(await this.cambiarEstadoUseCase.execute(id, dto, user.company_id!, user.sub));
  }

  @Post(':id/cancel')
  @Roles(Role.ADMIN, Role.AUX)
  @ApiOperation({ summary: 'Cancelar servicio', description: 'Cancela el servicio si está en PENDING, ASSIGNED o ACCEPTED. Libera al mensajero.' })
  @ApiParam({ name: 'id', description: 'UUID del servicio' })
  @ApiResponse({ status: 200, description: 'Servicio cancelado' })
  @ApiResponse({ status: 400, description: 'No se puede cancelar en el estado actual' })
  async cancelar(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return ok(await this.cancelarUseCase.execute(id, user.company_id!, user.sub));
  }

  @Get()
  @ApiOperation({ summary: 'Listar servicios', description: 'Filtra por status y/o courier_id. Siempre scoped a la empresa del token.' })
  @ApiQuery({ name: 'status', required: false, enum: ServiceStatus })
  @ApiQuery({ name: 'courier_id', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Lista de servicios' })
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: ServiceStatus,
    @Query('courier_id') courier_id?: string,
  ) {
    return ok(await this.consultarUseCase.findAll(user.company_id!, { status, courier_id }));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener servicio por ID' })
  @ApiParam({ name: 'id', description: 'UUID del servicio' })
  @ApiResponse({ status: 200, description: 'Servicio encontrado' })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  async findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return ok(await this.consultarUseCase.findOne(id, user.company_id!));
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Historial de estados del servicio' })
  @ApiParam({ name: 'id', description: 'UUID del servicio' })
  @ApiResponse({ status: 200, description: 'Historial de transiciones' })
  async historial(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return ok(await this.consultarUseCase.findHistorial(id, user.company_id!));
  }
}
