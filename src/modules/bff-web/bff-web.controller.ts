import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Role } from '../../core/constants/roles.enum';
import { ok } from '../../core/utils/response.util';
import { JwtPayload } from '../../core/types/jwt-payload.type';
import { BffDashboardUseCase } from './application/use-cases/bff-dashboard.use-case';
import { BffActiveOrdersUseCase } from './application/use-cases/bff-active-orders.use-case';
import { BffReportsUseCase } from './application/use-cases/bff-reports.use-case';
import { BffSettlementsUseCase } from './application/use-cases/bff-settlements.use-case';
import { BffReportsQueryDto, BffSettlementsQueryDto } from './application/dto/bff-query.dto';

@ApiTags('BFF Web')
@ApiBearerAuth('access-token')
@Controller('api/bff')
@UseGuards(RolesGuard)
export class BffWebController {
  constructor(
    private readonly bffDashboard: BffDashboardUseCase,
    private readonly bffActiveOrders: BffActiveOrdersUseCase,
    private readonly bffReports: BffReportsUseCase,
    private readonly bffSettlements: BffSettlementsUseCase,
  ) {}

  @Get('dashboard')
  @Roles(Role.ADMIN, Role.AUX)
  @ApiOperation({
    summary: 'Datos del dashboard',
    description: 'Retorna en una sola llamada: servicios pendientes, mensajeros activos e ingresos del día.',
  })
  @ApiResponse({ status: 200, description: 'Dashboard data' })
  async getDashboard(@CurrentUser() user: JwtPayload) {
    return ok(await this.bffDashboard.execute(user.company_id!));
  }

  @Get('active-orders')
  @Roles(Role.ADMIN, Role.AUX)
  @ApiOperation({
    summary: 'Servicios activos + mensajeros disponibles',
    description: 'Retorna todos los servicios y los mensajeros disponibles para asignación en una sola llamada.',
  })
  @ApiResponse({ status: 200, description: 'Active orders data' })
  async getActiveOrders(@CurrentUser() user: JwtPayload) {
    return ok(await this.bffActiveOrders.execute(user.company_id!));
  }

  @Get('reports')
  @Roles(Role.ADMIN, Role.AUX)
  @ApiOperation({
    summary: 'Reportes consolidados',
    description: 'Retorna reporte de servicios y reporte financiero en una sola llamada. from y to son obligatorios.',
  })
  @ApiResponse({ status: 200, description: 'Reports data' })
  @ApiResponse({ status: 400, description: 'from y to son obligatorios' })
  async getReports(@Query() query: BffReportsQueryDto, @CurrentUser() user: JwtPayload) {
    return ok(await this.bffReports.execute(query, user.company_id!));
  }

  @Get('settlements')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Datos de liquidaciones',
    description: 'Retorna mensajeros activos, regla activa y resumen de ganancias en una sola llamada. courier_id es opcional.',
  })
  @ApiResponse({ status: 200, description: 'Settlements data' })
  async getSettlements(@Query() query: BffSettlementsQueryDto, @CurrentUser() user: JwtPayload) {
    return ok(await this.bffSettlements.execute(user.company_id!, query.courier_id));
  }
}
