import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { SubirEvidenciaUseCase } from './application/use-cases/subir-evidencia.use-case';
import { ConsultarEvidenciaUseCase } from './application/use-cases/consultar-evidencia.use-case';
import { SubirEvidenciaDto } from './application/dto/subir-evidencia.dto';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Role } from '../../core/constants/roles.enum';
import { JwtPayload } from '../../core/types/jwt-payload.type';
import { ok } from '../../core/utils/response.util';

@ApiTags('Evidence')
@ApiBearerAuth('access-token')
@Controller('api/services/:id/evidence')
@UseGuards(RolesGuard)
export class EvidenciasController {
  constructor(
    private readonly subirUseCase: SubirEvidenciaUseCase,
    private readonly consultarUseCase: ConsultarEvidenciaUseCase,
  ) {}

  @Post()
  @Roles(Role.ADMIN, Role.AUX, Role.COURIER)
  @ApiOperation({
    summary: 'Subir evidencia de entrega',
    description: 'Solo cuando el servicio está en estado IN_TRANSIT. Re-subir reemplaza la evidencia existente (upsert).',
  })
  @ApiParam({ name: 'id', description: 'UUID del servicio' })
  @ApiResponse({ status: 201, description: 'Evidencia registrada' })
  @ApiResponse({ status: 400, description: 'Servicio no está IN_TRANSIT' })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  async subir(@Param('id') id: string, @Body() dto: SubirEvidenciaDto, @CurrentUser() user: JwtPayload) {
    return ok(await this.subirUseCase.execute(id, dto, user.company_id));
  }

  @Get()
  @ApiOperation({ summary: 'Consultar evidencia del servicio' })
  @ApiParam({ name: 'id', description: 'UUID del servicio' })
  @ApiResponse({ status: 200, description: 'Evidencia encontrada' })
  @ApiResponse({ status: 404, description: 'Sin evidencia registrada o servicio no encontrado' })
  async consultar(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return ok(await this.consultarUseCase.execute(id, user.company_id));
  }
}
