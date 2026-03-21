import * as fc from 'fast-check';
import { AuditLogService, AuditLogEntry } from '../../src/modules/super-admin/domain/audit-log.service';

describe('AuditLogService', () => {
  function makeRepo(shouldFail = false) {
    return {
      createAuditLog: jest.fn().mockImplementation(() => {
        if (shouldFail) throw new Error('DB error');
        return Promise.resolve({ id: 'log-id' });
      }),
    } as any;
  }

  const sampleEntry: AuditLogEntry = {
    super_admin_id: 'admin-id',
    action: 'DELETE_TENANT',
    entity_type: 'Company',
    entity_id: 'company-id',
  };

  // Unit test: best-effort — fallo no lanza excepción
  it('should not throw when repo fails (best-effort)', async () => {
    const service = new AuditLogService(makeRepo(true));
    await expect(service.log(sampleEntry)).resolves.not.toThrow();
  });

  // Unit test: escritura exitosa llama al repo
  it('should call repo.createAuditLog with correct entry', async () => {
    const repo = makeRepo(false);
    const service = new AuditLogService(repo);
    await service.log(sampleEntry);
    expect(repo.createAuditLog).toHaveBeenCalledWith(sampleEntry);
  });

  // Property 8: cualquier entry válida se registra sin lanzar excepción
  // Validates: Requirements 2.7, 3.7
  it('P8: log() never throws regardless of entry content', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          super_admin_id: fc.uuid(),
          action: fc.string({ minLength: 1, maxLength: 50 }),
          entity_type: fc.constantFrom('Company', 'User', 'GlobalConfig'),
          entity_id: fc.uuid(),
        }),
        async (entry) => {
          const service = new AuditLogService(makeRepo(false));
          await expect(service.log(entry)).resolves.not.toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });
});
