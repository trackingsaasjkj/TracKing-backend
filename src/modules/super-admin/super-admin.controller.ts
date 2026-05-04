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
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserStatus } from '@prisma/client';
import { SuperAdminGuard } from '../../core/guards/super-admin.guard';
import { SuperAdminRepository } from './infrastructure/super-admin.repository';
import { AuditLogService } from './domain/audit-log.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
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
    protected readonly prisma: PrismaService,
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

  // ─── Parser Failure Report ───────────────────────────────────────────────────

  @Get('parser-report')
  @ApiOperation({
    summary: 'Informe de fallos del parser de WhatsApp',
    description: 'Muestra los casos donde el parser no detectó campos y la IA tuvo que intervenir. Útil para mejorar el parser.',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Resultados por página (default: 50)' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Offset para paginación' })
  @ApiQuery({ name: 'company_id', required: false, type: String, description: 'Filtrar por empresa' })
  @ApiResponse({ status: 200, description: 'Informe de fallos del parser' })
  async getParserReport(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('company_id') companyId?: string,
  ) {
    const take = limit ? parseInt(limit, 10) : 50;
    const skip = offset ? parseInt(offset, 10) : 0;

    const [logs, total] = await Promise.all([
      this.prisma.parserFailureLog.findMany({
        where: companyId ? { company_id: companyId } : {},
        orderBy: { created_at: 'desc' },
        take,
        skip,
      }),
      this.prisma.parserFailureLog.count({
        where: companyId ? { company_id: companyId } : {},
      }),
    ]);

    // Aggregate field failure stats
    const fieldStats: Record<string, number> = {};
    const patternStats: Record<string, number> = {};

    for (const log of logs) {
      for (const field of log.missing_fields) {
        fieldStats[field] = (fieldStats[field] ?? 0) + 1;
      }
      const diagnosis = log.ai_diagnosis as any[];
      if (Array.isArray(diagnosis)) {
        for (const d of diagnosis) {
          if (d.pattern_found) {
            patternStats[d.pattern_found] = (patternStats[d.pattern_found] ?? 0) + 1;
          }
        }
      }
    }

    // Sort stats
    const topFailingFields = Object.entries(fieldStats)
      .sort(([, a], [, b]) => b - a)
      .map(([field, count]) => ({ field, count }));

    const topPatterns = Object.entries(patternStats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([pattern, count]) => ({ pattern, count }));

    return ok({
      summary: {
        total_cases: total,
        top_failing_fields: topFailingFields,
        top_unrecognized_patterns: topPatterns,
      },
      cases: logs.map(log => ({
        id: log.id,
        company_id: log.company_id,
        created_at: log.created_at,
        raw_message: log.raw_message,
        missing_fields: log.missing_fields,
        parser_detected: log.parser_result,
        ai_completed: log.ai_result,
        diagnosis: log.ai_diagnosis,
      })),
      pagination: { total, limit: take, offset: skip },
    });
  }
}
