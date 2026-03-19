import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CompanyRepository } from './infrastructure/company.repository';
import { CreateCompanyDto } from './application/dto/create-company.dto';
import { Public } from '../../core/decorators/public.decorator';
import { ok } from '../../core/utils/response.util';

@ApiTags('Companies')
@Controller('api/companies')
export class CompanyController {
  constructor(private readonly companyRepo: CompanyRepository) {}

  @Public()
  @Post()
  @ApiOperation({ summary: 'Crear empresa (tenant)', description: 'Endpoint público para registrar una nueva empresa.' })
  @ApiResponse({ status: 201, description: 'Empresa creada' })
  async create(@Body() dto: CreateCompanyDto) {
    return ok(await this.companyRepo.create(dto.name));
  }

  @Get()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Listar empresas activas' })
  @ApiResponse({ status: 200, description: 'Lista de empresas' })
  async findAll() {
    return ok(await this.companyRepo.findAll());
  }
}
