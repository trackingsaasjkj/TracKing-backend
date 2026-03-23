import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CompanyRepository } from './infrastructure/company.repository';
import { CreateCompanyWithAdminDto } from './application/dto/create-company-with-admin.dto';
import { CreateCompanyWithAdminUseCase } from './application/use-cases/create-company-with-admin.use-case';
import { Public } from '../../core/decorators/public.decorator';
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
}
