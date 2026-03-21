import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { SuperAdminRepository } from './infrastructure/super-admin.repository';
import { AuditLogService } from './domain/audit-log.service';
import { SuperAdminController } from './super-admin.controller';

@Module({
  imports: [PrismaModule],
  controllers: [SuperAdminController],
  providers: [SuperAdminRepository, AuditLogService],
  exports: [SuperAdminRepository, AuditLogService],
})
export class SuperAdminModule {}
