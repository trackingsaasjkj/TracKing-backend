import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CustomersUseCases } from './application/use-cases/customers.use-cases';
import { CreateCustomerDto } from './application/dto/create-customer.dto';
import { UpdateCustomerDto } from './application/dto/update-customer.dto';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Role } from '../../core/constants/roles.enum';
import { JwtPayload } from '../../core/types/jwt-payload.type';
import { ok } from '../../core/utils/response.util';
import { PaginationDto } from '../../core/dto/pagination.dto';

@ApiTags('Customers')
@ApiBearerAuth('access-token')
@Controller('api/customers')
@UseGuards(RolesGuard)
export class CustomersController {
  constructor(private readonly useCases: CustomersUseCases) {}

  @Get()
  @Roles(Role.ADMIN, Role.AUX)
  @ApiOperation({ summary: 'Listar clientes activos de la empresa' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Número de página (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Registros por página (default: 20, max: 100)' })
  @ApiResponse({ status: 200, description: 'Lista de clientes' })
  async findAll(@CurrentUser() user: JwtPayload, @Query() pagination?: PaginationDto) {
    const hasPagination = pagination?.page !== undefined || pagination?.limit !== undefined;
    return ok(
      await this.useCases.findAll(
        user.company_id!,
        hasPagination ? { page: pagination!.page ?? 1, limit: pagination!.limit ?? 20 } : undefined,
      ),
    );
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.AUX)
  @ApiOperation({ summary: 'Obtener cliente por UUID' })
  @ApiParam({ name: 'id', description: 'UUID del cliente' })
  @ApiResponse({ status: 200, description: 'Cliente encontrado' })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  async findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return ok(await this.useCases.findById(id, user.company_id!));
  }

  @Post()
  @Roles(Role.ADMIN, Role.AUX)
  @ApiOperation({ summary: 'Crear cliente' })
  @ApiResponse({ status: 201, description: 'Cliente creado' })
  async create(@Body() dto: CreateCustomerDto, @CurrentUser() user: JwtPayload) {
    return ok(await this.useCases.create(dto, user.company_id!));
  }

  @Put(':id')
  @Roles(Role.ADMIN, Role.AUX)
  @ApiOperation({ summary: 'Actualizar cliente' })
  @ApiParam({ name: 'id', description: 'UUID del cliente' })
  @ApiResponse({ status: 200, description: 'Cliente actualizado' })
  async update(@Param('id') id: string, @Body() dto: UpdateCustomerDto, @CurrentUser() user: JwtPayload) {
    return ok(await this.useCases.update(id, dto, user.company_id!));
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Desactivar cliente (soft delete)', description: 'Marca el cliente como inactivo. No elimina el registro.' })
  @ApiParam({ name: 'id', description: 'UUID del cliente' })
  @ApiResponse({ status: 200, description: 'Cliente desactivado' })
  async deactivate(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    await this.useCases.deactivate(id, user.company_id!);
    return ok(null);
  }

  @Patch(':id/favorite')
  @Roles(Role.ADMIN, Role.AUX)
  @ApiOperation({ summary: 'Toggle favorito del cliente' })
  @ApiParam({ name: 'id', description: 'UUID del cliente' })
  @ApiResponse({ status: 200, description: 'Estado favorito actualizado' })
  async toggleFavorite(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return ok(await this.useCases.toggleFavorite(id, user.company_id!));
  }
}
