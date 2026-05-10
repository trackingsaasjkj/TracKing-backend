import { Module } from '@nestjs/common';
import { CompanyController } from './company.controller';
import { CompanyRepository } from './infrastructure/company.repository';
import { CreateCompanyWithAdminUseCase } from './application/use-cases/create-company-with-admin.use-case';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Module({
  controllers: [CompanyController],
  providers: [CompanyRepository, CreateCompanyWithAdminUseCase, PrismaService],
  exports: [CompanyRepository],
})
export class CompanyModule {}
