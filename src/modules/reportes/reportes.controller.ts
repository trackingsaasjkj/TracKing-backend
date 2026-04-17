import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ReporteServiciosUseCase } from './application/use-cases/reporte-servicios.use-case';
import { ReporteFinancieroUseCase } from './application/use-cases/reporte-financiero.use-case';
import { ReporteFavoritosUseCase } from './application/use-cases/reporte-favoritos.use-case';
import { ReporteServiciosQueryDto, ReporteFinancieroQueryDto, ReporteFavoritosQueryDto } from './application/dto/reporte-query.dto';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Role } from '../../core/constants/roles.enum';
import { JwtPayload } from '../../core/types/jwt-payload.type';
import { ok } from '../../core/utils/response.util';

@ApiTags('Reportes')
@ApiBearerAuth('access-token')
@Controller('api/reports')
@UseGuards(RolesGuard)
export class ReportesController {
  constructor(
    private readonly serviciosReport: ReporteServiciosUseCase,
    private readonly financieroReport: ReporteFinancieroUseCase,
    private readonly favoritosReport: ReporteFavoritosUseCase,
  ) {}

  @Get('services')
  @Roles(Role.ADMIN, Role.AUX)
  @ApiOperation({ summary: 'Reporte operativo de servicios' })
  @ApiQuery({ name: 'from', required: false, example: '2025-01-01' })
  @ApiQuery({ name: 'to', required: false, example: '2025-01-31' })
  @ApiQuery({ name: 'courier_id', required: false })
  @ApiResponse({ status: 200, description: 'Métricas operativas' })
  async services(@Query() query: ReporteServiciosQueryDto, @CurrentUser() user: JwtPayload) {
    return ok(await this.serviciosReport.execute(query, user.company_id!));
  }

  @Get('financial')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Reporte financiero por período', description: 'Requiere from y to.' })
  @ApiQuery({ name: 'from', required: true, example: '2025-01-01' })
  @ApiQuery({ name: 'to', required: true, example: '2025-01-31' })
  @ApiResponse({ status: 200, description: 'Métricas financieras' })
  @ApiResponse({ status: 400, description: 'Rango de fechas inválido o faltante' })
  async financial(@Query() query: ReporteFinancieroQueryDto, @CurrentUser() user: JwtPayload) {
    return ok(await this.financieroReport.execute(query, user.company_id!));
  }

  @Get('couriers')
  @Roles(Role.ADMIN, Role.AUX)
  @ApiOperation({ summary: 'Rendimiento por mensajero' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiResponse({ status: 200, description: 'Servicios agrupados por mensajero' })
  async couriers(@Query() query: ReporteServiciosQueryDto, @CurrentUser() user: JwtPayload) {
    const result = await this.serviciosReport.execute(query, user.company_id!);
    return ok({ period: result.period, by_courier: result.by_courier });
  }

  @Get('customers/favorites')
  @Roles(Role.ADMIN, Role.AUX)
  @ApiOperation({ summary: 'Reporte de clientes favoritos', description: 'Devuelve métricas de servicios y cobro para los clientes marcados como favoritos.' })
  @ApiQuery({ name: 'from', required: false, example: '2025-01-01', description: 'Fecha inicio (ISO date)' })
  @ApiQuery({ name: 'to', required: false, example: '2025-01-31', description: 'Fecha fin (ISO date)' })
  @ApiQuery({ name: 'customer_id', required: false, description: 'Filtrar por cliente específico (UUID)' })
  @ApiResponse({ status: 200, description: 'Lista de clientes favoritos con métricas de servicios y cobro' })
  async favoriteCustomers(@Query() query: ReporteFavoritosQueryDto, @CurrentUser() user: JwtPayload) {
    return ok(await this.favoritosReport.execute(query, user.company_id!));
  }
}
