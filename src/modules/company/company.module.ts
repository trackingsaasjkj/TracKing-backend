import { Module } from '@nestjs/common';
import { CompanyController } from './company.controller';
import { CompanyRepository } from './infrastructure/company.repository';
import { CreateCompanyWithAdminUseCase } from './application/use-cases/create-company-with-admin.use-case';

@Module({
  controllers: [CompanyController],
  providers: [CompanyRepository, CreateCompanyWithAdminUseCase],
  exports: [CompanyRepository],
})
export class CompanyModule {}
