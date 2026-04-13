import { Body, Controller, Get, Param, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Role } from '../../core/constants/roles.enum';
import { JwtPayload } from '../../core/types/jwt-payload.type';
import { ok } from '../../core/utils/response.util';
import { ConsultarMensajerosUseCase } from '../mensajeros/application/use-cases/consultar-mensajeros.use-case';
import { JornadaUseCase } from '../mensajeros/application/use-cases/jornada.use-case';
import { CambiarEstadoUseCase } from '../servicios/application/use-cases/cambiar-estado.use-case';
import { CambiarPagoUseCase } from '../servicios/application/use-cases/cambiar-pago.use-case';
import { RegistrarUbicacionUseCase } from '../tracking/application/use-cases/registrar-ubicacion.use-case';
import { SubirEvidenciaUseCase } from '../evidencias/application/use-cases/subir-evidencia.use-case';
import { ConsultarLiquidacionesUseCase } from '../liquidaciones/application/use-cases/consultar-liquidaciones.use-case';
import { CambiarEstadoDto } from '../servicios/application/dto/cambiar-estado.dto';
import { CambiarPagoDto } from '../servicios/application/dto/cambiar-pago.dto';
import { RegisterLocationDto } from '../tracking/application/dto/register-location.dto';

@ApiTags('Courier Mobile')
@ApiBearerAuth('access-token')
@Controller('api/courier')
@UseGuards(RolesGuard)
@Roles(Role.COURIER)
export class CourierMobileController {
  constructor(
    private readonly consultarUseCase: ConsultarMensajerosUseCase,
    private readonly jornadaUseCase: JornadaUseCase,
    private readonly cambiarEstadoUseCase: CambiarEstadoUseCase,
    private readonly cambiarPagoUseCase: CambiarPagoUseCase,
    private readonly registrarUbicacionUseCase: RegistrarUbicacionUseCase,
    private readonly subirEvidenciaUseCase: SubirEvidenciaUseCase,
    private readonly consultarLiquidacionesUseCase: ConsultarLiquidacionesUseCase,
  ) {}

  // ── Perfil ───────────────────────────────────────────────────────────────────

  @Get('me')
  @ApiOperation({ summary: 'Mi perfil de mensajero' })
  @ApiResponse({ status: 200, description: 'Perfil del mensajero autenticado' })
  async miPerfil(@CurrentUser() user: JwtPayload) {
    return ok(await this.consultarUseCase.findCourierByUserId(user.sub, user.company_id!));
  }

  // ── Jornada ──────────────────────────────────────────────────────────────────

  @Post('jornada/start')
  @ApiOperation({ summary: 'Iniciar jornada', description: 'Transición UNAVAILABLE → AVAILABLE.' })
  @ApiResponse({ status: 200, description: 'Jornada iniciada' })
  @ApiResponse({ status: 400, description: 'Transición inválida desde el estado actual' })
  async iniciarJornada(@CurrentUser() user: JwtPayload) {
    const courier = await this.consultarUseCase.findCourierByUserId(user.sub, user.company_id!);
    return ok(await this.jornadaUseCase.iniciar(courier.id, user.company_id!));
  }

  @Post('jornada/end')
  @ApiOperation({ summary: 'Finalizar jornada', description: 'Transición AVAILABLE → UNAVAILABLE. Bloqueado si hay servicios activos.' })
  @ApiResponse({ status: 200, description: 'Jornada finalizada' })
  @ApiResponse({ status: 400, description: 'Servicios activos pendientes o transición inválida' })
  async finalizarJornada(@CurrentUser() user: JwtPayload) {
    const courier = await this.consultarUseCase.findCourierByUserId(user.sub, user.company_id!);
    return ok(await this.jornadaUseCase.finalizar(courier.id, user.company_id!));
  }

  // ── Servicios ─────────────────────────────────────────────────────────────────

  @Get('services')
  @ApiOperation({ summary: 'Mis servicios asignados' })
  @ApiResponse({ status: 200, description: 'Lista de servicios del mensajero' })
  async misServicios(@CurrentUser() user: JwtPayload) {
    const courier = await this.consultarUseCase.findCourierByUserId(user.sub, user.company_id!);
    return ok(await this.consultarUseCase.findMyServices(courier.id, user.company_id!));
  }

  @Post('services/:id/status')
  @ApiOperation({
    summary: 'Cambiar estado de un servicio',
    description: 'Transiciones válidas: ASSIGNED→ACCEPTED, ACCEPTED→IN_TRANSIT, IN_TRANSIT→DELIVERED (requiere evidencia previa).',
  })
  @ApiParam({ name: 'id', description: 'UUID del servicio' })
  @ApiResponse({ status: 200, description: 'Estado actualizado' })
  @ApiResponse({ status: 400, description: 'Transición inválida o falta evidencia' })
  async cambiarEstado(
    @Param('id') id: string,
    @Body() dto: CambiarEstadoDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return ok(await this.cambiarEstadoUseCase.execute(id, dto, user.company_id!, user.sub));
  }

  // ── Pago ──────────────────────────────────────────────────────────────────────

  @Post('services/:id/payment')
  @ApiOperation({
    summary: 'Cambiar estado de pago',
    description:
      'PAGADO → payment_method cambia a EFECTIVO. NO_PAGADO → payment_method cambia a CREDITO.',
  })
  @ApiParam({ name: 'id', description: 'UUID del servicio' })
  @ApiResponse({ status: 200, description: 'Estado de pago actualizado' })
  async cambiarPago(
    @Param('id') id: string,
    @Body() dto: CambiarPagoDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return ok(await this.cambiarPagoUseCase.execute(id, dto, user.company_id!));
  }

  // ── Evidencia ─────────────────────────────────────────────────────────────────
  @Post('services/:id/evidence')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Imagen de evidencia (jpg, png, webp)' },
      },
      required: ['file'],
    },
  })
  @ApiOperation({ summary: 'Subir evidencia de entrega', description: 'Solo cuando el servicio está en estado IN_TRANSIT.' })
  @ApiParam({ name: 'id', description: 'UUID del servicio' })
  @ApiResponse({ status: 201, description: 'Evidencia registrada' })
  @ApiResponse({ status: 400, description: 'Servicio no está IN_TRANSIT' })
  async subirEvidencia(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
  ) {
    return ok(await this.subirEvidenciaUseCase.execute(id, file, user.company_id!));
  }

  // ── Ubicación ─────────────────────────────────────────────────────────────────

  @Post('location')
  @ApiOperation({ summary: 'Registrar ubicación actual', description: 'Solo cuando el mensajero está IN_SERVICE. Frecuencia recomendada: cada 15 segundos.' })
  @ApiResponse({ status: 201, description: 'Ubicación registrada' })
  @ApiResponse({ status: 400, description: 'Mensajero no está IN_SERVICE' })
  async registrarUbicacion(
    @Body() dto: RegisterLocationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const courier = await this.consultarUseCase.findCourierByUserId(user.sub, user.company_id!);
    return ok(await this.registrarUbicacionUseCase.execute(dto, courier.id, user.company_id!));
  }

  // ── Liquidaciones ─────────────────────────────────────────────────────────────

  @Get('settlements')
  @ApiOperation({ summary: 'Mis liquidaciones', description: 'Lista todas las liquidaciones generadas para el mensajero autenticado.' })
  @ApiResponse({ status: 200, description: 'Lista de liquidaciones del mensajero' })
  async misLiquidaciones(@CurrentUser() user: JwtPayload) {
    const courier = await this.consultarUseCase.findCourierByUserId(user.sub, user.company_id!);
    return ok(await this.consultarLiquidacionesUseCase.findCourierSettlements(user.company_id!, courier.id));
  }

  @Get('settlements/earnings')
  @ApiOperation({ summary: 'Resumen de mis ganancias', description: 'Total acumulado de ganancias, servicios y liquidaciones del mensajero autenticado.' })
  @ApiResponse({ status: 200, description: 'Resumen de ganancias' })
  async misGanancias(@CurrentUser() user: JwtPayload) {
    const courier = await this.consultarUseCase.findCourierByUserId(user.sub, user.company_id!);
    return ok(await this.consultarLiquidacionesUseCase.getEarnings(user.company_id!, courier.id));
  }

  @Get('settlements/:id')
  @ApiOperation({ summary: 'Detalle de una liquidación', description: 'Retorna el detalle de una liquidación específica. Solo accesible si pertenece al mensajero autenticado.' })
  @ApiParam({ name: 'id', description: 'UUID de la liquidación' })
  @ApiResponse({ status: 200, description: 'Detalle de la liquidación' })
  @ApiResponse({ status: 404, description: 'Liquidación no encontrada' })
  async detalleLiquidacion(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return ok(await this.consultarLiquidacionesUseCase.findCourierSettlementById(id, user.company_id!));
  }
}
