import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { UsersUseCases } from './application/use-cases/users.use-cases';
import { CreateUserDto } from './application/dto/create-user.dto';
import { UpdateUserDto } from './application/dto/update-user.dto';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { RequirePermissions } from '../../core/decorators/permissions.decorator';
import { RolesGuard } from '../../core/guards/roles.guard';
import { PermissionsGuard } from '../../core/guards/permissions.guard';
import { Role } from '../../core/constants/roles.enum';
import { Permission } from '../../core/constants/permissions.enum';
import { JwtPayload } from '../../core/types/jwt-payload.type';
import { ok } from '../../core/utils/response.util';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('api/users')
@UseGuards(RolesGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersUseCases: UsersUseCases) {}

  @Get()
  @RequirePermissions(Permission.USERS_READ)
  @ApiOperation({ summary: 'Listar usuarios de la empresa' })
  @ApiResponse({ status: 200, description: 'Lista de usuarios' })
  async findAll(@CurrentUser() user: JwtPayload) {
    return ok(await this.usersUseCases.findAll(user.company_id!));
  }

  @Get('email/:email')
  @Roles(Role.ADMIN, Role.AUX)
  @RequirePermissions(Permission.USERS_READ)
  @ApiOperation({ summary: 'Buscar usuario por email' })
  @ApiParam({ name: 'email', example: 'juan@empresa.com' })
  @ApiResponse({ status: 200, description: 'Usuario encontrado' })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  async findByEmail(@Param('email') email: string, @CurrentUser() user: JwtPayload) {
    return ok(await this.usersUseCases.findByEmail(email, user.company_id!));
  }

  @Get(':uuid')
  @RequirePermissions(Permission.USERS_READ)
  @ApiOperation({ summary: 'Obtener usuario por UUID' })
  @ApiParam({ name: 'uuid', description: 'UUID del usuario' })
  @ApiResponse({ status: 200, description: 'Usuario encontrado' })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  async findOne(@Param('uuid') uuid: string, @CurrentUser() user: JwtPayload) {
    return ok(await this.usersUseCases.findById(uuid, user.company_id!));
  }

  @Post()
  @Roles(Role.ADMIN)
  @RequirePermissions(Permission.USERS_CREATE)
  @ApiOperation({ summary: 'Crear usuario (ADMIN)', description: 'Requiere rol ADMIN.' })
  @ApiResponse({ status: 201, description: 'Usuario creado' })
  @ApiResponse({ status: 409, description: 'Email ya registrado' })
  async create(@Body() dto: CreateUserDto, @CurrentUser() user: JwtPayload) {
    return ok(await this.usersUseCases.create(dto, user.company_id!));
  }

  @Put(':uuid')
  @Roles(Role.ADMIN)
  @RequirePermissions(Permission.USERS_UPDATE)
  @ApiOperation({ summary: 'Actualizar usuario (ADMIN)' })
  @ApiParam({ name: 'uuid', description: 'UUID del usuario' })
  @ApiResponse({ status: 200, description: 'Usuario actualizado' })
  async update(@Param('uuid') uuid: string, @Body() dto: UpdateUserDto, @CurrentUser() user: JwtPayload) {
    return ok(await this.usersUseCases.update(uuid, dto, user.company_id!));
  }

  @Delete(':uuid')
  @Roles(Role.ADMIN)
  @RequirePermissions(Permission.USERS_DELETE)
  @ApiOperation({ summary: 'Eliminar usuario (ADMIN)' })
  @ApiParam({ name: 'uuid', description: 'UUID del usuario' })
  @ApiResponse({ status: 200, description: 'Usuario eliminado' })
  async remove(@Param('uuid') uuid: string, @CurrentUser() user: JwtPayload) {
    await this.usersUseCases.remove(uuid, user.company_id!);
    return ok(null);
  }
}
