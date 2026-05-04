/**
 * Tests Super Admin — GlobalConfig
 * specs/super-admin/global-config.use-case.spec.ts
 * Requirements: 6.6
 */
import * as fc from 'fast-check';
import { HttpStatus } from '@nestjs/common';
import { SuperAdminController } from '../../src/modules/super-admin/super-admin.controller';
import { AppException } from '../../src/core/errors/app.exception';
import { Role } from '../../src/core/constants/roles.enum';

// ─── 11.1 Mock factories ──────────────────────────────────────────────────────

function makeSuperAdminRepo() {
  return {
    createTenant: jest.fn(),
    updateTenantStatus: jest.fn(),
    deleteTenant: jest.fn(),
    findAllTenants: jest.fn(),
    findTenantById: jest.fn(),
    getTenantDetail: jest.fn(),
    getTenantMetrics: jest.fn(),
    getTenantsByVolume: jest.fn(),
    findUsersByTenant: jest.fn(),
    findUserById: jest.fn(),
    updateUserStatus: jest.fn(),
    updateUserRole: jest.fn(),
    deleteUser: jest.fn(),
    findAllConfig: jest.fn(),
    findConfigByKey: jest.fn(),
    createConfig: jest.fn(),
    updateConfig: jest.fn(),
    getDashboardMetrics: jest.fn(),
    createAuditLog: jest.fn(),
    findAuditLogs: jest.fn(),
  } as any;
}

function makeAuditLogService() {
  return {
    log: jest.fn().mockResolvedValue(undefined),
  } as any;
}

function makePrismaService() {
  return {
    parserFailureLog: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
  } as any;
}

// ─── 11.2 CreateConfig con key válida → retorna config con id ────────────────

describe('SuperAdminController.createConfig — key válida', () => {
  let repo: ReturnType<typeof makeSuperAdminRepo>;
  let auditLog: ReturnType<typeof makeAuditLogService>;
  let controller: SuperAdminController;

  beforeEach(() => {
    repo = makeSuperAdminRepo();
    auditLog = makeAuditLogService();
    controller = new SuperAdminController(repo, auditLog, makePrismaService());
  });

  it('11.2: key válida → retorna config con id', async () => {
    const config = { id: 'config-uuid', key: 'MAX_COURIERS', value: '50', description: 'Max couriers' };
    repo.createConfig.mockResolvedValue(config);

    const result = await controller.createConfig({ key: 'MAX_COURIERS', value: '50', description: 'Max couriers' });

    expect(result).toHaveProperty('data');
    expect(result.data).toHaveProperty('id', 'config-uuid');
    expect(result.data.key).toBe('MAX_COURIERS');
    expect(repo.createConfig).toHaveBeenCalledWith({ key: 'MAX_COURIERS', value: '50', description: 'Max couriers' });
  });
});

// ─── 11.3 CreateConfig con key duplicada → AppException 409 ──────────────────

describe('SuperAdminController.createConfig — key duplicada', () => {
  let repo: ReturnType<typeof makeSuperAdminRepo>;
  let auditLog: ReturnType<typeof makeAuditLogService>;
  let controller: SuperAdminController;

  beforeEach(() => {
    repo = makeSuperAdminRepo();
    auditLog = makeAuditLogService();
    controller = new SuperAdminController(repo, auditLog, makePrismaService());
  });

  it('11.3: key duplicada → AppException 409', async () => {
    repo.createConfig.mockRejectedValue(
      new AppException('Ya existe una configuración con esa clave', HttpStatus.CONFLICT),
    );

    await expect(
      controller.createConfig({ key: 'MAX_COURIERS', value: '50' }),
    ).rejects.toThrow(AppException);

    try {
      await controller.createConfig({ key: 'MAX_COURIERS', value: '50' });
    } catch (err: any) {
      expect(err.getStatus()).toBe(HttpStatus.CONFLICT);
    }
  });
});

// ─── 11.4 UpdateConfig con key existente → persiste nuevo valor ──────────────

describe('SuperAdminController.updateConfig — key existente', () => {
  let repo: ReturnType<typeof makeSuperAdminRepo>;
  let auditLog: ReturnType<typeof makeAuditLogService>;
  let controller: SuperAdminController;

  beforeEach(() => {
    repo = makeSuperAdminRepo();
    auditLog = makeAuditLogService();
    controller = new SuperAdminController(repo, auditLog, makePrismaService());
  });

  it('11.4: key existente → persiste nuevo valor', async () => {
    const existing = { id: 'config-uuid', key: 'MAX_COURIERS', value: '50' };
    const updated = { id: 'config-uuid', key: 'MAX_COURIERS', value: '100' };

    repo.findConfigByKey.mockResolvedValue(existing);
    repo.updateConfig.mockResolvedValue(updated);

    const result = await controller.updateConfig('MAX_COURIERS', { value: '100' });

    expect(result.data.value).toBe('100');
    expect(repo.findConfigByKey).toHaveBeenCalledWith('MAX_COURIERS');
    expect(repo.updateConfig).toHaveBeenCalledWith('MAX_COURIERS', '100');
  });
});

// ─── 11.5 UpdateConfig con key inexistente → AppException 404 ────────────────

describe('SuperAdminController.updateConfig — key inexistente', () => {
  let repo: ReturnType<typeof makeSuperAdminRepo>;
  let auditLog: ReturnType<typeof makeAuditLogService>;
  let controller: SuperAdminController;

  beforeEach(() => {
    repo = makeSuperAdminRepo();
    auditLog = makeAuditLogService();
    controller = new SuperAdminController(repo, auditLog, makePrismaService());
  });

  it('11.5: key inexistente → AppException 404', async () => {
    repo.findConfigByKey.mockResolvedValue(null);

    await expect(
      controller.updateConfig('NON_EXISTENT_KEY', { value: 'anything' }),
    ).rejects.toThrow(AppException);

    try {
      await controller.updateConfig('NON_EXISTENT_KEY', { value: 'anything' });
    } catch (err: any) {
      expect(err.getStatus()).toBe(HttpStatus.NOT_FOUND);
    }
  });
});

// ─── 11.6 PBT P12: fc.string() como value → update siempre persiste el valor ─

describe('P12: fc.string() como value → update siempre persiste el valor enviado (PBT)', () => {
  /**
   * Validates: Requirements 6.6
   * Feature: super-admin-control, Property 12: Update de config siempre persiste el valor enviado
   */
  it('P12: cualquier string como value → update persiste ese valor', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string(),
        async (value) => {
          const repo = makeSuperAdminRepo();
          const auditLog = makeAuditLogService();
          const controller = new SuperAdminController(repo, auditLog, makePrismaService());

          const existing = { id: 'config-uuid', key: 'SOME_KEY', value: 'old-value' };
          const updated = { id: 'config-uuid', key: 'SOME_KEY', value };

          repo.findConfigByKey.mockResolvedValue(existing);
          repo.updateConfig.mockResolvedValue(updated);

          const result = await controller.updateConfig('SOME_KEY', { value });

          expect(result.data.value).toBe(value);
          expect(repo.updateConfig).toHaveBeenCalledWith('SOME_KEY', value);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── 11.7 PBT P13: fc.string() como key inexistente → siempre AppException 404

describe('P13: fc.string() como key inexistente → siempre AppException 404 (PBT)', () => {
  /**
   * Validates: Requirements 6.6
   * Feature: super-admin-control, Property 13: Key inexistente siempre lanza 404
   */
  it('P13: key inexistente → siempre AppException 404', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        async (key) => {
          const repo = makeSuperAdminRepo();
          const auditLog = makeAuditLogService();
          const controller = new SuperAdminController(repo, auditLog, makePrismaService());

          repo.findConfigByKey.mockResolvedValue(null);

          await expect(
            controller.updateConfig(key, { value: 'any-value' }),
          ).rejects.toThrow(AppException);

          try {
            await controller.updateConfig(key, { value: 'any-value' });
          } catch (err: any) {
            expect(err.getStatus()).toBe(HttpStatus.NOT_FOUND);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── 11.8 PBT P14: key duplicada → siempre AppException 409 ──────────────────

describe('P14: key duplicada → siempre AppException 409 (PBT)', () => {
  /**
   * Validates: Requirements 6.6
   * Feature: super-admin-control, Property 14: Key duplicada en createConfig siempre lanza 409
   */
  it('P14: key duplicada → siempre AppException 409', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        async (key, value) => {
          const repo = makeSuperAdminRepo();
          const auditLog = makeAuditLogService();
          const controller = new SuperAdminController(repo, auditLog, makePrismaService());

          repo.createConfig.mockRejectedValue(
            new AppException('Ya existe una configuración con esa clave', HttpStatus.CONFLICT),
          );

          await expect(
            controller.createConfig({ key, value }),
          ).rejects.toThrow(AppException);

          try {
            await controller.createConfig({ key, value });
          } catch (err: any) {
            expect(err.getStatus()).toBe(HttpStatus.CONFLICT);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
