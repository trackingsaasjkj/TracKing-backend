import { Body, Controller, Post, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchDto } from './application/dto/search.dto';
import { ReverseSearchDto } from './application/dto/reverse-search.dto';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Role } from '../../core/constants/roles.enum';
import { JwtPayload } from '../../core/types/jwt-payload.type';
import { ok } from '../../core/utils/response.util';

@ApiTags('Search')
@ApiBearerAuth('access-token')
@Controller('api/search')
@UseGuards(RolesGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post('forward')
  @Roles(Role.ADMIN, Role.AUX)
  @ApiOperation({
    summary: 'Buscar direcciones',
    description: 'Busca direcciones y puntos de interés usando Mapbox Search Box API. Resultado cacheado 1h.',
  })
  @ApiResponse({ status: 200, description: 'Sugerencias obtenidas' })
  @ApiResponse({ status: 502, description: 'Error al comunicarse con Mapbox' })
  async forward(
    @Body() dto: SearchDto,
    @Query('limit') limit?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    const suggestions = await this.searchService.search(dto.query, user?.company_id!, {
      limit: limit ? parseInt(limit, 10) : 5,
      city: dto.city,
    });
    return ok(suggestions);
  }

  @Post('reverse')
  @Roles(Role.ADMIN, Role.AUX)
  @ApiOperation({
    summary: 'Búsqueda inversa',
    description: 'Convierte coordenadas en dirección usando Mapbox Search Box API. Resultado cacheado 1h.',
  })
  @ApiResponse({ status: 200, description: 'Dirección obtenida' })
  @ApiResponse({ status: 502, description: 'Error al comunicarse con Mapbox' })
  async reverse(@Body() dto: ReverseSearchDto, @CurrentUser() user?: JwtPayload) {
    const suggestion = await this.searchService.reverse(dto.lng, dto.lat, user?.company_id!);
    return ok(suggestion);
  }
}
