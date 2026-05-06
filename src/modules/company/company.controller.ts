import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CompanyRepository } from './infrastructure/company.repository';
import { CreateCompanyWithAdminDto } from './application/dto/create-company-with-admin.dto';
import { UpdateAutoAssignDto } from './application/dto/update-auto-assign.dto';
import { CreateCompanyWithAdminUseCase } from './application/use-cases/create-company-with-admin.use-case';
import { Public } from '../../core/decorators/public.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { Role } from '../../core/constants/roles.enum';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { JwtPayload } from '../../core/types/jwt-payload.type';
import { ok } from '../../core/utils/response.util';

@ApiTags('Companies')
@Controller('api/companies')
export class CompanyController {
  constructor(
    private readonly companyRepo: CompanyRepository,
    private readonly createCompanyWithAdmin: CreateCompanyWithAdminUseCase,
  ) {}

  @Public()
  @Post('setup')
  @ApiOperation({
    summary: 'Crear empresa con admin (setup inicial)',
    description: 'Crea la empresa y su usuario ADMIN en una sola transacción atómica.',
  })
  @ApiResponse({ status: 201, description: 'Empresa y admin creados' })
  async setup(@Body() dto: CreateCompanyWithAdminDto) {
    return ok(await this.createCompanyWithAdmin.execute(dto));
  }

  @Get()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Listar empresas activas' })
  @ApiResponse({ status: 200, description: 'Lista de empresas' })
  async findAll() {
    return ok(await this.companyRepo.findAll());
  }

  @Get('settings/auto-assign')
  @ApiBearerAuth('access-token')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Obtener configuración de autoasignación de la empresa' })
  @ApiResponse({ status: 200, description: 'Configuración de autoasignación' })
  async getAutoAssign(@CurrentUser() user: JwtPayload) {
    const result = await this.companyRepo.getAutoAssignMode(user.company_id!);
    return ok({ auto_assign_mode: result?.auto_assign_mode ?? null });
  }

  @Patch('settings/auto-assign')
  @ApiBearerAuth('access-token')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Actualizar modo de autoasignación',
    description: 'Enviar auto_assign_mode: null para desactivar la autoasignación.',
  })
  @ApiResponse({ status: 200, description: 'Configuración actualizada' })
  async updateAutoAssign(@Body() dto: UpdateAutoAssignDto, @CurrentUser() user: JwtPayload) {
    const result = await this.companyRepo.updateAutoAssignMode(
      user.company_id!,
      dto.auto_assign_mode ?? null,
    );
    return ok(result);
  }
}
