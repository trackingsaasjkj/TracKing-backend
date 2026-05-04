/**
 * Tests Super Admin — Tenants
 * specs/super-admin/tenants.use-case.spec.ts
 * Requirements: 6.4
 */
import * as fc from 'fast-check';
import { HttpStatus } from '@nestjs/common';
import { SuperAdminController } from '../../src/modules/super-admin/super-admin.controller';
import { AppException } from '../../src/core/errors/app.exception';
import { JwtPayload } from '../../src/core/types/jwt-payload.type';
import { Role } from '../../src/core/constants/roles.enum';

// ─── 9.1 Mock factories ───────────────────────────────────────────────────────

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

const mockUser: JwtPayload = {
  sub: 'admin-uuid',
  email: 'superadmin@test.com',
  role: Role.SUPER_ADMIN,
  company_id: null,
};

// ─── 9.2 CreateTenant con nombre válido → retorna tenant con id ───────────────

describe('SuperAdminController.createTenant', () => {
  let repo: ReturnType<typeof makeSuperAdminRepo>;
  let auditLog: ReturnType<typeof makeAuditLogService>;
  let controller: SuperAdminController;

  beforeEach(() => {
    repo = makeSuperAdminRepo();
    auditLog = makeAuditLogService();
    controller = new SuperAdminController(repo, auditLog, makePrismaService());
  });

  // 9.2 Unit test: nombre válido → retorna tenant con id
  it('9.2: nombre válido → retorna tenant con id', async () => {
    const tenant = { id: 'tenant-uuid', name: 'Empresa Test', status: true };
    repo.createTenant.mockResolvedValue(tenant);

    const result = await controller.createTenant({ name: 'Empresa Test' });

    expect(result).toHaveProperty('data');
    expect(result.data).toHaveProperty('id', 'tenant-uuid');
    expect(repo.createTenant).toHaveBeenCalledWith('Empresa Test');
  });

  // 9.3 Unit test: nombre duplicado → AppException 409
  it('9.3: nombre duplicado → AppException 409', async () => {
    repo.createTenant.mockRejectedValue(
      new AppException('Ya existe un tenant con ese nombre', HttpStatus.CONFLICT),
    );

    await expect(controller.createTenant({ name: 'Duplicado' })).rejects.toThrow(AppException);

    try {
      await controller.createTenant({ name: 'Duplicado' });
    } catch (err: any) {
      expect(err.getStatus()).toBe(HttpStatus.CONFLICT);
    }
  });
});

// ─── 9.4 SuspendTenant → status = false ──────────────────────────────────────

describe('SuperAdminController.suspendTenant', () => {
  let repo: ReturnType<typeof makeSuperAdminRepo>;
  let auditLog: ReturnType<typeof makeAuditLogService>;
  let controller: SuperAdminController;

  beforeEach(() => {
    repo = makeSuperAdminRepo();
    auditLog = makeAuditLogService();
    controller = new SuperAdminController(repo, auditLog, makePrismaService());
  });

  // 9.4 Unit test: suspendTenant → status = false
  it('9.4: suspendTenant → status = false', async () => {
    const suspended = { id: 'tenant-uuid', name: 'Empresa', status: false };
    repo.updateTenantStatus.mockResolvedValue(suspended);

    const result = await controller.suspendTenant('tenant-uuid');

    expect(result.data.status).toBe(false);
    expect(repo.updateTenantStatus).toHaveBeenCalledWith('tenant-uuid', false);
  });
});

// ─── 9.5 ReactivateTenant → status = true ────────────────────────────────────

describe('SuperAdminController.reactivateTenant', () => {
  let repo: ReturnType<typeof makeSuperAdminRepo>;
  let auditLog: ReturnType<typeof makeAuditLogService>;
  let controller: SuperAdminController;

  beforeEach(() => {
    repo = makeSuperAdminRepo();
    auditLog = makeAuditLogService();
    controller = new SuperAdminController(repo, auditLog, makePrismaService());
  });

  // 9.5 Unit test: reactivateTenant → status = true
  it('9.5: reactivateTenant → status = true', async () => {
    const reactivated = { id: 'tenant-uuid', name: 'Empresa', status: true };
    repo.updateTenantStatus.mockResolvedValue(reactivated);

    const result = await controller.reactivateTenant('tenant-uuid');

    expect(result.data.status).toBe(true);
    expect(repo.updateTenantStatus).toHaveBeenCalledWith('tenant-uuid', true);
  });
});

// ─── 9.6 DeleteTenant → llama auditLogService.log con action: 'DELETE_TENANT' ─

describe('SuperAdminController.deleteTenant', () => {
  let repo: ReturnType<typeof makeSuperAdminRepo>;
  let auditLog: ReturnType<typeof makeAuditLogService>;
  let controller: SuperAdminController;

  beforeEach(() => {
    repo = makeSuperAdminRepo();
    auditLog = makeAuditLogService();
    controller = new SuperAdminController(repo, auditLog, makePrismaService());
  });

  // 9.6 Unit test: deleteTenant → llama auditLogService.log con action: 'DELETE_TENANT'
  it('9.6: deleteTenant → llama auditLog.log con action DELETE_TENANT', async () => {
    repo.deleteTenant.mockResolvedValue({ id: 'tenant-uuid' });

    await controller.deleteTenant('tenant-uuid', mockUser);

    expect(auditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DELETE_TENANT',
        entity_id: 'tenant-uuid',
        entity_type: 'Company',
        super_admin_id: mockUser.sub,
      }),
    );
  });
});

// ─── 9.7 PBT P4: nombre válido → siempre retorna id ─────────────────────────

describe('P4: createTenant con nombre válido siempre retorna id (PBT)', () => {
  /**
   * Validates: Requirements 6.4
   * Feature: super-admin-control, Property 4: Creación de tenant con nombre válido retorna tenant con id
   */
  it('P4: fc.string({ minLength: 1, maxLength: 100 }) → crear tenant siempre retorna id', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }),
        async (name) => {
          const repo = makeSuperAdminRepo();
          const auditLog = makeAuditLogService();
          const controller = new SuperAdminController(repo, auditLog, makePrismaService());

          repo.createTenant.mockResolvedValue({ id: 'tenant-id', name });

          const result = await controller.createTenant({ name });

          expect(result.data).toHaveProperty('id');
          expect(result.data.id).toBeTruthy();
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── 9.8 PBT P5: nombre duplicado siempre → AppException 409 ─────────────────

describe('P5: nombre duplicado siempre lanza AppException 409 (PBT)', () => {
  /**
   * Validates: Requirements 6.4
   * Feature: super-admin-control, Property 5: Nombre de tenant duplicado retorna 409
   */
  it('P5: nombre duplicado siempre → AppException 409', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }),
        async (name) => {
          const repo = makeSuperAdminRepo();
          const auditLog = makeAuditLogService();
          const controller = new SuperAdminController(repo, auditLog, makePrismaService());

          repo.createTenant.mockRejectedValue(
            new AppException('Ya existe un tenant con ese nombre', HttpStatus.CONFLICT),
          );

          await expect(controller.createTenant({ name })).rejects.toThrow(AppException);

          try {
            await controller.createTenant({ name });
          } catch (err: any) {
            expect(err.getStatus()).toBe(HttpStatus.CONFLICT);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── 9.9 PBT P6: suspend → reactivate → status = true ───────────────────────

describe('P6: round-trip suspend → reactivate → status = true (PBT)', () => {
  /**
   * Validates: Requirements 6.4
   * Feature: super-admin-control, Property 6: Round-trip suspend/reactivate de tenant
   */
  it('P6: suspend → reactivate → status = true', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        async (tenantId) => {
          const repo = makeSuperAdminRepo();
          const auditLog = makeAuditLogService();
          const controller = new SuperAdminController(repo, auditLog, makePrismaService());

          repo.updateTenantStatus
            .mockResolvedValueOnce({ id: tenantId, status: false })
            .mockResolvedValueOnce({ id: tenantId, status: true });

          const suspended = await controller.suspendTenant(tenantId);
          expect(suspended.data.status).toBe(false);

          const reactivated = await controller.reactivateTenant(tenantId);
          expect(reactivated.data.status).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
