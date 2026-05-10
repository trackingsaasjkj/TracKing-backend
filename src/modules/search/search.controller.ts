import { Body, Controller, Post, Get, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { GlobalSearchUseCase } from './application/use-cases/global-search.use-case';
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
  constructor(
    private readonly searchService: SearchService,
    private readonly globalSearchUseCase: GlobalSearchUseCase,
  ) {}

  @Get('global')
  @Roles(Role.ADMIN, Role.AUX)
  @ApiOperation({
    summary: 'Búsqueda global',
    description: 'Busca en clientes, mensajeros, usuarios y servicios de la empresa. Mínimo 2 caracteres.',
  })
  @ApiQuery({ name: 'q', required: true, type: String, description: 'Texto a buscar (mín. 2 caracteres)' })
  @ApiResponse({ status: 200, description: 'Resultados agrupados por entidad' })
  async globalSearch(@Query('q') q: string, @CurrentUser() user: JwtPayload) {
    if (!q || q.trim().length < 2) return ok({ customers: [], couriers: [], users: [], services: [] });
    return ok(await this.globalSearchUseCase.execute(q, user.company_id!));
  }

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
