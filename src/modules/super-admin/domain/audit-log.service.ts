import { Injectable, Logger } from '@nestjs/common';
import { SuperAdminRepository } from '../infrastructure/super-admin.repository';

export interface AuditLogEntry {
  super_admin_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  payload?: Record<string, unknown>;
  ip_address?: string;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly repo: SuperAdminRepository) {}

  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.repo.createAuditLog(entry);
    } catch (error) {
      this.logger.error('Failed to write audit log', { entry, error });
      // best-effort: no re-throw
    }
  }
}
