import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../core/decorators/roles.decorator';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Role } from '../../core/constants/roles.enum';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { JwtPayload } from '../../core/types/jwt-payload.type';
import { ok } from '../../core/utils/response.util';
import { SuscripcionesUseCases } from './application/use-cases/suscripciones.use-cases';
import { CreateSuscripcionDto } from './application/dto/create-suscripcion.dto';

// ── Super Admin endpoints ─────────────────────────────────────────────────────

@ApiTags('Super Admin — Suscripciones')
@ApiBearerAuth('access-token')
@Controller('super-admin/subscriptions')
@UseGuards(RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class SuscripcionesAdminController {
  constructor(private readonly useCases: SuscripcionesUseCases) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas las suscripciones' })
  @ApiResponse({ status: 200, description: 'Lista de suscripciones' })
  async findAll() {
    return ok(await this.useCases.findAll());
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener suscripción por ID' })
  @ApiParam({ name: 'id', description: 'UUID de la suscripción' })
  @ApiResponse({ status: 200, description: 'Suscripción encontrada' })
  @ApiResponse({ status: 404, description: 'No encontrada' })
  async findOne(@Param('id') id: string) {
    return ok(await this.useCases.findById(id));
  }

  @Post()
  @ApiOperation({
    summary: 'Crear suscripción para una empresa',
    description: 'Si la empresa ya tiene una suscripción activa, se cancela automáticamente. end_date default: start_date + 1 mes.',
  })
  @ApiResponse({ status: 201, description: 'Suscripción creada' })
  @ApiResponse({ status: 400, description: 'Plan inactivo o fechas inválidas' })
  @ApiResponse({ status: 404, description: 'Empresa o plan no encontrado' })
  async create(@Body() dto: CreateSuscripcionDto) {
    return ok(await this.useCases.create(dto));
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancelar suscripción' })
  @ApiParam({ name: 'id', description: 'UUID de la suscripción' })
  @ApiResponse({ status: 200, description: 'Suscripción cancelada' })
  @ApiResponse({ status: 400, description: 'La suscripción no está activa' })
  async cancel(@Param('id') id: string) {
    return ok(await this.useCases.cancel(id));
  }
}

// ── Admin de empresa endpoint ─────────────────────────────────────────────────

@ApiTags('Suscripción')
@ApiBearerAuth('access-token')
@Controller('api/my-subscription')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
export class SuscripcionEmpresaController {
  constructor(private readonly useCases: SuscripcionesUseCases) {}

  @Get()
  @ApiOperation({ summary: 'Mi suscripción activa', description: 'Retorna la suscripción activa de la empresa del token.' })
  @ApiResponse({ status: 200, description: 'Suscripción activa con datos del plan' })
  @ApiResponse({ status: 404, description: 'No hay suscripción activa' })
  async miSuscripcion(@CurrentUser() user: JwtPayload) {
    return ok(await this.useCases.findActiveByCompany(user.company_id!));
  }
}
