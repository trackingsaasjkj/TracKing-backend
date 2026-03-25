import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../core/decorators/roles.decorator';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Role } from '../../core/constants/roles.enum';
import { ok } from '../../core/utils/response.util';
import { PlanesUseCases } from './application/use-cases/planes.use-cases';
import { CreatePlanDto } from './application/dto/create-plan.dto';
import { UpdatePlanDto } from './application/dto/update-plan.dto';

@ApiTags('Super Admin — Planes')
@ApiBearerAuth('access-token')
@Controller('super-admin/plans')
@UseGuards(RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class PlanesController {
  constructor(private readonly useCases: PlanesUseCases) {}

  @Get()
  @ApiOperation({ summary: 'Listar todos los planes' })
  @ApiResponse({ status: 200, description: 'Lista de planes' })
  async findAll() {
    return ok(await this.useCases.findAll());
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener plan por ID' })
  @ApiParam({ name: 'id', description: 'UUID del plan' })
  @ApiResponse({ status: 200, description: 'Plan encontrado' })
  @ApiResponse({ status: 404, description: 'Plan no encontrado' })
  async findOne(@Param('id') id: string) {
    return ok(await this.useCases.findById(id));
  }

  @Post()
  @ApiOperation({ summary: 'Crear nuevo plan' })
  @ApiResponse({ status: 201, description: 'Plan creado' })
  @ApiResponse({ status: 409, description: 'Ya existe un plan con ese nombre' })
  async create(@Body() dto: CreatePlanDto) {
    return ok(await this.useCases.create(dto));
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar plan' })
  @ApiParam({ name: 'id', description: 'UUID del plan' })
  @ApiResponse({ status: 200, description: 'Plan actualizado' })
  @ApiResponse({ status: 404, description: 'Plan no encontrado' })
  async update(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return ok(await this.useCases.update(id, dto));
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Desactivar plan', description: 'No afecta suscripciones existentes. Falla si hay suscripciones activas.' })
  @ApiParam({ name: 'id', description: 'UUID del plan' })
  @ApiResponse({ status: 200, description: 'Plan desactivado' })
  @ApiResponse({ status: 400, description: 'Plan tiene suscripciones activas' })
  async deactivate(@Param('id') id: string) {
    return ok(await this.useCases.deactivate(id));
  }
}
