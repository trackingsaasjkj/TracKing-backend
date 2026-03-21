import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserStatus } from '@prisma/client';
import { SuperAdminGuard } from '../../core/guards/super-admin.guard';
import { SuperAdminRepository } from './infrastructure/super-admin.repository';
import { AuditLogService } from './domain/audit-log.service';
import { PaginationDto } from './application/dto/pagination.dto';
import { CreateTenantDto } from './application/dto/create-tenant.dto';
import { UpdateUserRoleDto } from './application/dto/update-user-role.dto';
import { AppException } from '../../core/errors/app.exception';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { JwtPayload } from '../../core/types/jwt-payload.type';
import { Role } from '../../core/constants/roles.enum';
import { ok } from '../../core/utils/response.util';
import { CreateGlobalConfigDto } from './application/dto/create-global-config.dto';
import { UpdateGlobalConfigDto } from './application/dto/update-global-config.dto';
import { AuditLogFilterDto } from './application/dto/audit-log-filter.dto';

@ApiTags('Super Admin')
@ApiBearerAuth('access-token')
@UseGuards(SuperAdminGuard)
@Throttle({ 'super-admin': { limit: 30, ttl: 60000 } })
@Controller('super-admin')
export class SuperAdminController {
  constructor(
    protected readonly repo: SuperAdminRepository,
    protected readonly auditLog: AuditLogService,
  ) {}

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  // ─── Métricas ────────────────────────────────────────────────────────────────

  @Get('dashboard')
  @ApiOperation({ summary: 'Métricas globales del dashboard' })
  @ApiResponse({ status: 200, description: 'Métricas globales' })
  async getDashboard() {
    const result = await this.repo.getDashboardMetrics();
    return ok(result);
  }

  // ─── Tenants ────────────────────────────────────────────────────────────────

  @Get('tenants')
  @ApiOperation({ summary: 'Listar tenants paginados' })
  @ApiResponse({ status: 200, description: 'Lista de tenants' })
  async listTenants(@Query() pagination: PaginationDto) {
    const result = await this.repo.findAllTenants(pagination.page ?? 1, pagination.limit ?? 20);
    return ok(result);
  }

  @Post('tenants')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear tenant' })
  @ApiResponse({ status: 201, description: 'Tenant creado' })
  async createTenant(@Body() dto: CreateTenantDto) {
    const result = await this.repo.createTenant(dto.name);
    return ok(result);
  }

  @Get('tenants/by-volume')
  @ApiOperation({ summary: 'Tenants por volumen de servicios' })
  @ApiResponse({ status: 200, description: 'Tenants ordenados por volumen' })
  async getTenantsByVolume(@Query('from') from: string, @Query('to') to: string) {
    const result = await this.repo.getTenantsByVolume(new Date(from), new Date(to));
    return ok(result);
  }

  @Get('tenants/:id')
  @ApiOperation({ summary: 'Detalle de tenant' })
  @ApiResponse({ status: 200, description: 'Detalle del tenant' })
  @ApiResponse({ status: 404, description: 'Tenant no encontrado' })
  async getTenantDetail(@Param('id') id: string) {
    const result = await this.repo.getTenantDetail(id);
    if (!result) throw new AppException('Tenant no encontrado', HttpStatus.NOT_FOUND);
    return ok(result);
  }

  @Get('tenants/:id/metrics')
  @ApiOperation({ summary: 'Métricas de un tenant específico' })
  @ApiResponse({ status: 200, description: 'Métricas del tenant' })
  async getTenantMetrics(
    @Param('id') id: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const result = await this.repo.getTenantMetrics(id, new Date(from), new Date(to));
    return ok(result);
  }

  @Patch('tenants/:id/suspend')
  @ApiOperation({ summary: 'Suspender tenant' })
  @ApiResponse({ status: 200, description: 'Tenant suspendido' })
  async suspendTenant(@Param('id') id: string) {
    const result = await this.repo.updateTenantStatus(id, false);
    return ok(result);
  }

  @Patch('tenants/:id/reactivate')
  @ApiOperation({ summary: 'Reactivar tenant' })
  @ApiResponse({ status: 200, description: 'Tenant reactivado' })
  async reactivateTenant(@Param('id') id: string) {
    const result = await this.repo.updateTenantStatus(id, true);
    return ok(result);
  }

  @Delete('tenants/:id')
  @ApiOperation({ summary: 'Eliminar tenant' })
  @ApiResponse({ status: 200, description: 'Tenant eliminado' })
  async deleteTenant(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    await this.repo.deleteTenant(id);
    await this.auditLog.log({
      super_admin_id: user.sub,
      action: 'DELETE_TENANT',
      entity_type: 'Company',
      entity_id: id,
    });
    return ok({ deleted: true });
  }

  // ─── Usuarios ───────────────────────────────────────────────────────────────

  @Get('tenants/:id/users')
  @ApiOperation({ summary: 'Listar usuarios del tenant' })
  @ApiResponse({ status: 200, description: 'Lista de usuarios del tenant' })
  async listTenantUsers(
    @Param('id') tenantId: string,
    @Query() pagination: PaginationDto,
    @Query('role') role?: string,
    @Query('status') status?: string,
  ) {
    const result = await this.repo.findUsersByTenant(tenantId, { role, status }, pagination.page ?? 1, pagination.limit ?? 20);
    return ok(result);
  }

  @Patch('users/:id/suspend')
  @ApiOperation({ summary: 'Suspender usuario' })
  @ApiResponse({ status: 200, description: 'Usuario suspendido' })
  async suspendUser(@Param('id') id: string) {
    const result = await this.repo.updateUserStatus(id, UserStatus.SUSPENDED);
    return ok(result);
  }

  @Patch('users/:id/reactivate')
  @ApiOperation({ summary: 'Reactivar usuario' })
  @ApiResponse({ status: 200, description: 'Usuario reactivado' })
  async reactivateUser(@Param('id') id: string) {
    const result = await this.repo.updateUserStatus(id, UserStatus.ACTIVE);
    return ok(result);
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: 'Cambiar rol de usuario' })
  @ApiResponse({ status: 200, description: 'Rol actualizado' })
  @ApiResponse({ status: 422, description: 'Super Admins no pueden pertenecer a un tenant' })
  async changeUserRole(@Param('id') id: string, @Body() dto: UpdateUserRoleDto) {
    const user = await this.repo.findUserById(id);
    if (dto.role === Role.SUPER_ADMIN && user.company_id !== null) {
      throw new AppException('Los Super Admins no pueden pertenecer a un tenant', HttpStatus.UNPROCESSABLE_ENTITY);
    }
    const result = await this.repo.updateUserRole(id, dto.role);
    return ok(result);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Eliminar usuario' })
  @ApiResponse({ status: 200, description: 'Usuario eliminado' })
  async deleteUser(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    await this.repo.deleteUser(id);
    await this.auditLog.log({
      super_admin_id: user.sub,
      action: 'DELETE_USER',
      entity_type: 'User',
      entity_id: id,
    });
    return ok({ deleted: true });
  }

  // ─── Configuración Global ────────────────────────────────────────────────────

  @Get('config')
  @ApiOperation({ summary: 'Listar configuraciones globales' })
  @ApiResponse({ status: 200, description: 'Lista de configuraciones' })
  async listConfig() {
    const result = await this.repo.findAllConfig();
    return ok(result);
  }

  @Post('config')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear configuración global' })
  @ApiResponse({ status: 201, description: 'Configuración creada' })
  async createConfig(@Body() dto: CreateGlobalConfigDto) {
    const result = await this.repo.createConfig(dto);
    return ok(result);
  }

  @Patch('config/:key')
  @ApiOperation({ summary: 'Actualizar configuración global por clave' })
  @ApiResponse({ status: 200, description: 'Configuración actualizada' })
  @ApiResponse({ status: 404, description: 'Configuración no encontrada' })
  async updateConfig(@Param('key') key: string, @Body() dto: UpdateGlobalConfigDto) {
    const existing = await this.repo.findConfigByKey(key);
    if (!existing) throw new AppException('Configuración no encontrada', HttpStatus.NOT_FOUND);
    const result = await this.repo.updateConfig(key, dto.value);
    return ok(result);
  }

  // ─── Audit Log ───────────────────────────────────────────────────────────────

  @Get('audit-log')
  @ApiOperation({ summary: 'Consultar audit log con filtros' })
  @ApiResponse({ status: 200, description: 'Registros de auditoría' })
  async getAuditLog(@Query() filters: AuditLogFilterDto) {
    const result = await this.repo.findAuditLogs(filters, filters.page ?? 1, filters.limit ?? 20);
    return ok(result);
  }
}
