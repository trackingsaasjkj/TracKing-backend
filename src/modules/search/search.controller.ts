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
import { SearchSessionService } from './providers/session/search-session.service';
import { GooglePlacesService } from './providers/google-places/google-places.service';
import { GooglePlacesDetailsService } from './providers/google-places/google-places-details.service';
import { SearchBoxSuggestion } from './providers/search-provider.interface';

@ApiTags('Search')
@ApiBearerAuth('access-token')
@Controller('api/search')
@UseGuards(RolesGuard)
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly globalSearchUseCase: GlobalSearchUseCase,
    private readonly sessionService: SearchSessionService,
    private readonly googlePlacesService: GooglePlacesService,
    private readonly googlePlacesDetailsService: GooglePlacesDetailsService,
  ) {}

  @Post('session/create')
  @Roles(Role.ADMIN, Role.AUX)
  @ApiOperation({
    summary: 'Crear sesión de búsqueda',
    description: 'Crea una nueva sesión para optimizar búsquedas con Google Places. La sesión expira en 10 minutos.',
  })
  @ApiResponse({ status: 200, description: 'Sesión creada exitosamente' })
  async createSession(@CurrentUser() user: JwtPayload) {
    const sessionToken = this.sessionService.createSession();
    return ok({ sessionToken });
  }

  @Post('session/end')
  @Roles(Role.ADMIN, Role.AUX)
  @ApiOperation({
    summary: 'Finalizar sesión de búsqueda',
    description: 'Finaliza una sesión de búsqueda.',
  })
  @ApiResponse({ status: 200, description: 'Sesión finalizada' })
  async endSession(@Body() body: { sessionToken: string }) {
    this.sessionService.endSession(body.sessionToken);
    return ok({ message: 'Sesión finalizada' });
  }

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
    description: 'Busca direcciones usando Google Places API. Resultado cacheado 1h. Usa sessionToken para optimizar.',
  })
  @ApiResponse({ status: 200, description: 'Sugerencias obtenidas' })
  @ApiResponse({ status: 502, description: 'Error al comunicarse con Google Places' })
  async forward(
    @Body() dto: SearchDto,
    @Query('limit') limit?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    const suggestions = await this.searchService.search(dto.query, user?.company_id!, {
      limit: limit ? parseInt(limit, 10) : 5,
      city: dto.city,
      sessionToken: dto.sessionToken,
      companyId: user?.company_id ?? undefined,
    });
    return ok(suggestions);
  }

  @Post('reverse')
  @Roles(Role.ADMIN, Role.AUX)
  @ApiOperation({
    summary: 'Búsqueda inversa',
    description: 'Convierte coordenadas en dirección usando Google Geocoding API. Resultado cacheado 1h.',
  })
  @ApiResponse({ status: 200, description: 'Dirección obtenida' })
  @ApiResponse({ status: 502, description: 'Error al comunicarse con Google Geocoding' })
  async reverse(@Body() dto: ReverseSearchDto, @CurrentUser() user?: JwtPayload) {
    const suggestion = await this.searchService.reverse(dto.lng, dto.lat, user?.company_id!);
    return ok(suggestion);
  }

  @Get('history')
  @Roles(Role.ADMIN, Role.AUX)
  @ApiOperation({
    summary: 'Historial de direcciones',
    description: 'Obtiene las últimas direcciones usadas por el usuario. Útil para preload inteligente.',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Máximo de resultados (default: 10)' })
  @ApiResponse({ status: 200, description: 'Historial de direcciones' })
  async getAddressHistory(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: string,
  ) {
    const history = await this.googlePlacesService.getUserAddressHistory(
      user.sub,
      user.company_id!,
      limit ? parseInt(limit, 10) : 10,
    );
    return ok(history);
  }

  @Post('history/record')
  @Roles(Role.ADMIN, Role.AUX)
  @ApiOperation({
    summary: 'Registrar dirección seleccionada',
    description: 'Registra una dirección en el historial del usuario cuando la selecciona.',
  })
  @ApiResponse({ status: 200, description: 'Dirección registrada' })
  async recordAddressSelection(
    @CurrentUser() user: JwtPayload,
    @Body() suggestion: SearchBoxSuggestion,
  ) {
    await this.googlePlacesService.recordAddressSelection(
      user.sub,
      user.company_id!,
      suggestion,
    );
    return ok({ recorded: true });
  }

  @Post('details')
  @Roles(Role.ADMIN, Role.AUX)
  @ApiOperation({
    summary: 'Obtener coordenadas de un lugar por placeId',
    description: 'Llama a Google Place Details para obtener lat/lng exactos de una sugerencia seleccionada.',
  })
  @ApiResponse({ status: 200, description: 'Detalles del lugar con coordenadas' })
  @ApiResponse({ status: 502, description: 'Error al comunicarse con Google Place Details' })
  async getPlaceDetails(
    @Body() body: { placeId: string },
    @CurrentUser() user: JwtPayload,
  ) {
    const details = await this.googlePlacesDetailsService.getPlaceDetails(
      body.placeId,
      user.company_id!,
    );
    return ok(details);
  }
}
