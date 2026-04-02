import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { GenerarLiquidacionCourierUseCase } from './application/use-cases/generar-liquidacion-courier.use-case';
import { GenerarLiquidacionClienteUseCase } from './application/use-cases/generar-liquidacion-cliente.use-case';
import { ConsultarLiquidacionesUseCase } from './application/use-cases/consultar-liquidaciones.use-case';
import { GestionarReglasUseCase } from './application/use-cases/gestionar-reglas.use-case';
import { GenerarLiquidacionCourierDto } from './application/dto/generar-liquidacion-courier.dto';
import { GenerarLiquidacionClienteDto } from './application/dto/generar-liquidacion-cliente.dto';
import { CreateRuleDto } from './application/dto/create-rule.dto';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Role } from '../../core/constants/roles.enum';
import { JwtPayload } from '../../core/types/jwt-payload.type';
import { ok } from '../../core/utils/response.util';

@ApiTags('Liquidaciones')
@ApiBearerAuth('access-token')
@Controller('api/liquidations')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
export class LiquidacionesController {
  constructor(
    private readonly generarCourierUseCase: GenerarLiquidacionCourierUseCase,
    private readonly generarClienteUseCase: GenerarLiquidacionClienteUseCase,
    private readonly consultarUseCase: ConsultarLiquidacionesUseCase,
    private readonly reglasUseCase: GestionarReglasUseCase,
  ) {}

  // ── Settlement Rules ────────────────────────────────────────

  @Post('rules')
  @ApiOperation({ summary: 'Crear regla de liquidación', description: 'Desactiva la regla anterior y crea una nueva activa. Solo ADMIN.' })
  @ApiResponse({ status: 201, description: 'Regla creada' })
  async createRule(@Body() dto: CreateRuleDto, @CurrentUser() user: JwtPayload) {
    return ok(await this.reglasUseCase.create(dto, user.company_id!));
  }

  @Get('rules')
  @ApiOperation({ summary: 'Listar reglas de liquidación' })
  @ApiResponse({ status: 200, description: 'Lista de reglas' })
  async findRules(@CurrentUser() user: JwtPayload) {
    return ok(await this.reglasUseCase.findAll(user.company_id!));
  }

  @Get('rules/active')
  @ApiOperation({ summary: 'Regla activa actual' })
  @ApiResponse({ status: 200, description: 'Regla activa' })
  async findActiveRule(@CurrentUser() user: JwtPayload) {
    return ok(await this.reglasUseCase.findActive(user.company_id!));
  }

  // ── Generate Settlements ────────────────────────────────────

  @Post('generate/courier')
  @ApiOperation({
    summary: 'Generar liquidación de mensajero',
    description: 'Calcula el pago al mensajero por servicios DELIVERED en el rango. Requiere regla activa.',
  })
  @ApiResponse({ status: 201, description: 'Liquidación generada' })
  @ApiResponse({ status: 400, description: 'Sin servicios en el rango, total inválido o sin regla activa' })
  @ApiResponse({ status: 404, description: 'Mensajero no encontrado' })
  async generateCourier(@Body() dto: GenerarLiquidacionCourierDto, @CurrentUser() user: JwtPayload) {
    return ok(await this.generarCourierUseCase.execute(dto, user.company_id!));
  }

  @Post('generate/customer')
  @ApiOperation({
    summary: 'Generar liquidación de cliente (facturación)',
    description: 'Suma total_price de todos los servicios DELIVERED en el rango.',
  })
  @ApiResponse({ status: 201, description: 'Liquidación generada' })
  @ApiResponse({ status: 400, description: 'Sin servicios en el rango o total inválido' })
  async generateCustomer(@Body() dto: GenerarLiquidacionClienteDto, @CurrentUser() user: JwtPayload) {
    return ok(await this.generarClienteUseCase.execute(dto, user.company_id!));
  }

  // ── Query Settlements ───────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Listar liquidaciones de mensajeros' })
  @ApiQuery({ name: 'courier_id', required: false, description: 'Filtrar por mensajero' })
  @ApiResponse({ status: 200, description: 'Lista de liquidaciones' })
  async findAll(@CurrentUser() user: JwtPayload, @Query('courier_id') courier_id?: string) {
    return ok(await this.consultarUseCase.findCourierSettlements(user.company_id!, courier_id));
  }

  @Get('customer')
  @ApiOperation({ summary: 'Listar liquidaciones de clientes (facturación)' })
  @ApiQuery({ name: 'customer_id', required: false, description: 'Filtrar por cliente' })
  @ApiResponse({ status: 200, description: 'Lista de liquidaciones de clientes' })
  async findCustomer(@CurrentUser() user: JwtPayload, @Query('customer_id') customer_id?: string) {
    return ok(await this.consultarUseCase.findCustomerSettlements(user.company_id!, customer_id));
  }

  @Get('earnings')
  @ApiOperation({ summary: 'Resumen de ganancias', description: 'Totales acumulados de liquidaciones. Filtrable por courier_id.' })
  @ApiQuery({ name: 'courier_id', required: false })
  @ApiResponse({ status: 200, description: 'Resumen de ganancias' })
  async earnings(@CurrentUser() user: JwtPayload, @Query('courier_id') courier_id?: string) {
    return ok(await this.consultarUseCase.getEarnings(user.company_id!, courier_id));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de liquidación de mensajero' })
  @ApiParam({ name: 'id', description: 'UUID de la liquidación' })
  @ApiResponse({ status: 200, description: 'Liquidación encontrada' })
  @ApiResponse({ status: 404, description: 'No encontrada' })
  async findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return ok(await this.consultarUseCase.findCourierSettlementById(id, user.company_id!));
  }
}
