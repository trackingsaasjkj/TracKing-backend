import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CrearMensajeroUseCase } from './application/use-cases/crear-mensajero.use-case';
import { ConsultarMensajerosUseCase } from './application/use-cases/consultar-mensajeros.use-case';
import { UpdateMensajeroUseCase } from './application/use-cases/update-mensajero.use-case';
import { CreateMensajeroDto } from './application/dto/create-mensajero.dto';
import { UpdateMensajeroDto } from './application/dto/update-mensajero.dto';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Role } from '../../core/constants/roles.enum';
import { JwtPayload } from '../../core/types/jwt-payload.type';
import { ok } from '../../core/utils/response.util';

@ApiTags('Mensajeros')
@ApiBearerAuth('access-token')
@Controller('api/mensajeros')
@UseGuards(RolesGuard)
export class MensajerosController {
  constructor(
    private readonly crearUseCase: CrearMensajeroUseCase,
    private readonly consultarUseCase: ConsultarMensajerosUseCase,
    private readonly updateUseCase: UpdateMensajeroUseCase,
  ) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Crear perfil de mensajero (ADMIN)', description: 'Asocia un usuario con rol COURIER a un perfil de mensajero.' })
  @ApiResponse({ status: 201, description: 'Mensajero creado' })
  @ApiResponse({ status: 409, description: 'El usuario ya tiene perfil de mensajero' })
  async crear(@Body() dto: CreateMensajeroDto, @CurrentUser() user: JwtPayload) {
    return ok(await this.crearUseCase.execute(dto, user.company_id!));
  }

  @Get()
  @Roles(Role.ADMIN, Role.AUX)
  @ApiOperation({ summary: 'Listar todos los mensajeros' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Número de página (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Elementos por página (default: 20, max: 100)' })
  @ApiResponse({ status: 200, description: 'Lista de mensajeros' })
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const hasPagination = page !== undefined || limit !== undefined;
    const pagination = hasPagination
      ? { page: page ? parseInt(page, 10) : 1, limit: limit ? parseInt(limit, 10) : 20 }
      : undefined;
    return ok(await this.consultarUseCase.findAll(user.company_id!, pagination));
  }

  @Get('activos')
  @Roles(Role.ADMIN, Role.AUX)
  @ApiOperation({ summary: 'Listar mensajeros AVAILABLE', description: 'Solo mensajeros con estado operacional AVAILABLE.' })
  @ApiResponse({ status: 200, description: 'Mensajeros disponibles' })
  async findActivos(@CurrentUser() user: JwtPayload) {
    return ok(await this.consultarUseCase.findActivos(user.company_id!));
  }


  @Get(':id')
  @Roles(Role.ADMIN, Role.AUX)
  @ApiOperation({ summary: 'Obtener mensajero por ID' })
  @ApiParam({ name: 'id', description: 'UUID del mensajero' })
  @ApiResponse({ status: 200, description: 'Mensajero encontrado' })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  async findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return ok(await this.consultarUseCase.findOne(id, user.company_id!));
  }

  @Put(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Actualizar mensajero (ADMIN)' })
  @ApiParam({ name: 'id', description: 'UUID del mensajero' })
  @ApiResponse({ status: 200, description: 'Mensajero actualizado' })
  async update(@Param('id') id: string, @Body() dto: UpdateMensajeroDto, @CurrentUser() user: JwtPayload) {
    return ok(await this.updateUseCase.execute(id, dto, user.company_id!));
  }
}
