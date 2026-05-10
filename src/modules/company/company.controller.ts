import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CompanyRepository } from './infrastructure/company.repository';
import { CreateCompanyWithAdminDto } from './application/dto/create-company-with-admin.dto';
import { UpdateAutoAssignDto } from './application/dto/update-auto-assign.dto';
import { CreateCompanyWithAdminUseCase } from './application/use-cases/create-company-with-admin.use-case';
import { Public } from '../../core/decorators/public.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { RequirePermissions } from '../../core/decorators/permissions.decorator';
import { Role } from '../../core/constants/roles.enum';
import { Permission } from '../../core/constants/permissions.enum';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { JwtPayload } from '../../core/types/jwt-payload.type';
import { ok } from '../../core/utils/response.util';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@ApiTags('Companies')
@Controller('api/companies')
export class CompanyController {
  constructor(
    private readonly companyRepo: CompanyRepository,
    private readonly createCompanyWithAdmin: CreateCompanyWithAdminUseCase,
    private readonly prisma: PrismaService,
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
  @Roles(Role.ADMIN, Role.AUX)
  @RequirePermissions(Permission.SETTINGS_VIEW)
  @ApiOperation({ summary: 'Obtener configuración de autoasignación. AUX: su config personal (o empresa si no tiene).' })
  @ApiResponse({ status: 200, description: 'Configuración de autoasignación' })
  async getAutoAssign(@CurrentUser() user: JwtPayload) {
    if (user.role === Role.AUX) {
      const auxUser = await this.prisma.user.findUnique({
        where: { id: user.sub },
        select: { auto_assign_mode: true },
      });
      // If AUX has personal config, return it; otherwise fall back to company config
      if (auxUser?.auto_assign_mode !== undefined && auxUser.auto_assign_mode !== null) {
        return ok({ auto_assign_mode: auxUser.auto_assign_mode });
      }
    }
    const result = await this.companyRepo.getAutoAssignMode(user.company_id!);
    return ok({ auto_assign_mode: result?.auto_assign_mode ?? null });
  }

  @Patch('settings/auto-assign')
  @ApiBearerAuth('access-token')
  @Roles(Role.ADMIN, Role.AUX)
  @RequirePermissions(Permission.SETTINGS_VIEW)
  @ApiOperation({ summary: 'Actualizar autoasignación. ADMIN: empresa. AUX: personal.' })
  @ApiResponse({ status: 200, description: 'Configuración actualizada' })
  async updateAutoAssign(@Body() dto: UpdateAutoAssignDto, @CurrentUser() user: JwtPayload) {
    if (user.role === Role.AUX) {
      const updated = await this.prisma.user.update({
        where: { id: user.sub },
        data: { auto_assign_mode: dto.auto_assign_mode ?? null },
        select: { id: true, auto_assign_mode: true },
      });
      return ok({ auto_assign_mode: updated.auto_assign_mode });
    }
    const result = await this.companyRepo.updateAutoAssignMode(
      user.company_id!,
      dto.auto_assign_mode ?? null,
    );
    return ok(result);
  }
}
