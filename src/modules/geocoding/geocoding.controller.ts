import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { GeocodingService } from './geocoding.service';
import { ForwardGeocodingDto } from './application/dto/forward-geocoding.dto';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Role } from '../../core/constants/roles.enum';
import { JwtPayload } from '../../core/types/jwt-payload.type';
import { ok } from '../../core/utils/response.util';

@ApiTags('Geocoding')
@ApiBearerAuth('access-token')
@Controller('api/geocoding')
@UseGuards(RolesGuard)
export class GeocodingController {
  constructor(private readonly geocodingService: GeocodingService) {}

  @Post('forward')
  @Roles(Role.ADMIN, Role.AUX)
  @ApiOperation({ summary: 'Geocodificar dirección', description: 'Convierte texto de dirección en coordenadas (lat, lng) usando Mapbox. Resultado cacheado 24h.' })
  @ApiResponse({ status: 200, description: 'Coordenadas obtenidas' })
  @ApiResponse({ status: 404, description: 'No se encontraron resultados para la dirección' })
  @ApiResponse({ status: 502, description: 'Error al comunicarse con Mapbox' })
  async forward(@Body() dto: ForwardGeocodingDto, @CurrentUser() user: JwtPayload) {
    return ok(await this.geocodingService.forwardGeocode(dto.address, user.company_id!));
  }
}
