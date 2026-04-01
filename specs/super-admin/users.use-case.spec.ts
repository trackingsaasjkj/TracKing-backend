/**
 * Tests Super Admin — Users
 * specs/super-admin/users.use-case.spec.ts
 * Requirements: 6.5
 */
import * as fc from 'fast-check';
import { HttpStatus } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { SuperAdminController } from '../../src/modules/super-admin/super-admin.controller';
import { AppException } from '../../src/core/errors/app.exception';
import { Role } from '../../src/core/constants/roles.enum';
import { JwtPayload } from '../../src/core/types/jwt-payload.type';

// ─── 10.1 Mock factories ──────────────────────────────────────────────────────

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

const mockAdminUser: JwtPayload = {
  sub: 'super-admin-uuid',
  email: 'superadmin@test.com',
  role: Role.SUPER_ADMIN,
  company_id: null,
};

// ─── 10.2 SuspendUser → status = SUSPENDED ───────────────────────────────────

describe('SuperAdminController.suspendUser', () => {
  let repo: ReturnType<typeof makeSuperAdminRepo>;
  let auditLog: ReturnType<typeof makeAuditLogService>;
  let controller: SuperAdminController;

  beforeEach(() => {
    repo = makeSuperAdminRepo();
    auditLog = makeAuditLogService();
    controller = new SuperAdminController(repo, auditLog);
  });

  it('10.2: suspendUser → status = SUSPENDED', async () => {
    const suspended = { id: 'user-uuid', status: UserStatus.SUSPENDED };
    repo.updateUserStatus.mockResolvedValue(suspended);

    const result = await controller.suspendUser('user-uuid');

    expect(result.data.status).toBe(UserStatus.SUSPENDED);
    expect(repo.updateUserStatus).toHaveBeenCalledWith('user-uuid', UserStatus.SUSPENDED);
  });
});

// ─── 10.3 ReactivateUser → status = ACTIVE ───────────────────────────────────

describe('SuperAdminController.reactivateUser', () => {
  let repo: ReturnType<typeof makeSuperAdminRepo>;
  let auditLog: ReturnType<typeof makeAuditLogService>;
  let controller: SuperAdminController;

  beforeEach(() => {
    repo = makeSuperAdminRepo();
    auditLog = makeAuditLogService();
    controller = new SuperAdminController(repo, auditLog);
  });

  it('10.3: reactivateUser → status = ACTIVE', async () => {
    const active = { id: 'user-uuid', status: UserStatus.ACTIVE };
    repo.updateUserStatus.mockResolvedValue(active);

    const result = await controller.reactivateUser('user-uuid');

    expect(result.data.status).toBe(UserStatus.ACTIVE);
    expect(repo.updateUserStatus).toHaveBeenCalledWith('user-uuid', UserStatus.ACTIVE);
  });
});

// ─── 10.4 ChangeUserRole con rol válido → persiste nuevo rol ─────────────────

describe('SuperAdminController.changeUserRole — rol válido', () => {
  let repo: ReturnType<typeof makeSuperAdminRepo>;
  let auditLog: ReturnType<typeof makeAuditLogService>;
  let controller: SuperAdminController;

  beforeEach(() => {
    repo = makeSuperAdminRepo();
    auditLog = makeAuditLogService();
    controller = new SuperAdminController(repo, auditLog);
  });

  it('10.4: rol válido con company_id = null → persiste nuevo rol', async () => {
    const existingUser = { id: 'user-uuid', role: Role.AUX, company_id: null };
    const updatedUser = { id: 'user-uuid', role: Role.ADMIN, company_id: null };

    repo.findUserById.mockResolvedValue(existingUser);
    repo.updateUserRole.mockResolvedValue(updatedUser);

    const result = await controller.changeUserRole('user-uuid', { role: Role.ADMIN });

    expect(result.data.role).toBe(Role.ADMIN);
    expect(repo.updateUserRole).toHaveBeenCalledWith('user-uuid', Role.ADMIN);
  });
});

// ─── 10.5 ChangeUserRole con SUPER_ADMIN y company_id != null → AppException 422

describe('SuperAdminController.changeUserRole — SUPER_ADMIN con company_id', () => {
  let repo: ReturnType<typeof makeSuperAdminRepo>;
  let auditLog: ReturnType<typeof makeAuditLogService>;
  let controller: SuperAdminController;

  beforeEach(() => {
    repo = makeSuperAdminRepo();
    auditLog = makeAuditLogService();
    controller = new SuperAdminController(repo, auditLog);
  });

  it('10.5: SUPER_ADMIN + company_id != null → AppException 422', async () => {
    const existingUser = { id: 'user-uuid', role: Role.ADMIN, company_id: 'some-company-id' };
    repo.findUserById.mockResolvedValue(existingUser);

    await expect(
      controller.changeUserRole('user-uuid', { role: Role.SUPER_ADMIN }),
    ).rejects.toThrow(AppException);

    try {
      await controller.changeUserRole('user-uuid', { role: Role.SUPER_ADMIN });
    } catch (err: any) {
      expect(err.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    }
  });
});

// ─── 10.6 DeleteUser → llama auditLogService.log con action: 'DELETE_USER' ───

describe('SuperAdminController.deleteUser', () => {
  let repo: ReturnType<typeof makeSuperAdminRepo>;
  let auditLog: ReturnType<typeof makeAuditLogService>;
  let controller: SuperAdminController;

  beforeEach(() => {
    repo = makeSuperAdminRepo();
    auditLog = makeAuditLogService();
    controller = new SuperAdminController(repo, auditLog);
  });

  it('10.6: deleteUser → llama auditLog.log con action DELETE_USER', async () => {
    repo.deleteUser.mockResolvedValue({ id: 'user-uuid' });

    await controller.deleteUser('user-uuid', mockAdminUser);

    expect(auditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DELETE_USER',
        entity_id: 'user-uuid',
        entity_type: 'User',
        super_admin_id: mockAdminUser.sub,
      }),
    );
  });
});

// ─── 10.7 PBT P9: suspend → reactivate → status = ACTIVE ────────────────────

describe('P9: round-trip suspend → reactivate → status = ACTIVE (PBT)', () => {
  /**
   * Validates: Requirements 6.5
   * Feature: super-admin-control, Property 9: Round-trip suspend/reactivate de usuario
   */
  it('P9: suspend → reactivate → status = ACTIVE', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        async (userId) => {
          const repo = makeSuperAdminRepo();
          const auditLog = makeAuditLogService();
          const controller = new SuperAdminController(repo, auditLog);

          repo.updateUserStatus
            .mockResolvedValueOnce({ id: userId, status: UserStatus.SUSPENDED })
            .mockResolvedValueOnce({ id: userId, status: UserStatus.ACTIVE });

          const suspended = await controller.suspendUser(userId);
          expect(suspended.data.status).toBe(UserStatus.SUSPENDED);

          const reactivated = await controller.reactivateUser(userId);
          expect(reactivated.data.status).toBe(UserStatus.ACTIVE);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── 10.8 PBT P10: roles válidos → rol persiste ──────────────────────────────

describe('P10: fc.constantFrom(ADMIN, AUX, COURIER) → rol persiste (PBT)', () => {
  /**
   * Validates: Requirements 6.5
   * Feature: super-admin-control, Property 10: Cambio de rol válido siempre persiste
   */
  it('P10: rol válido (ADMIN/AUX/COURIER) → rol persiste', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.constantFrom(Role.ADMIN, Role.AUX, Role.COURIER),
        async (userId, role) => {
          const repo = makeSuperAdminRepo();
          const auditLog = makeAuditLogService();
          const controller = new SuperAdminController(repo, auditLog);

          repo.findUserById.mockResolvedValue({ id: userId, role: Role.AUX, company_id: null });
          repo.updateUserRole.mockResolvedValue({ id: userId, role });

          const result = await controller.changeUserRole(userId, { role });

          expect(result.data.role).toBe(role);
          expect(repo.updateUserRole).toHaveBeenCalledWith(userId, role);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── 10.9 PBT P11: fc.uuid() como company_id + SUPER_ADMIN → AppException 422 ─

describe('P11: fc.uuid() como company_id + SUPER_ADMIN → AppException 422 (PBT)', () => {
  /**
   * Validates: Requirements 6.5
   * Feature: super-admin-control, Property 11: SUPER_ADMIN con company_id siempre lanza 422
   */
  it('P11: company_id != null + SUPER_ADMIN → AppException 422', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        async (userId, companyId) => {
          const repo = makeSuperAdminRepo();
          const auditLog = makeAuditLogService();
          const controller = new SuperAdminController(repo, auditLog);

          repo.findUserById.mockResolvedValue({ id: userId, role: Role.ADMIN, company_id: companyId });

          await expect(
            controller.changeUserRole(userId, { role: Role.SUPER_ADMIN }),
          ).rejects.toThrow(AppException);

          try {
            await controller.changeUserRole(userId, { role: Role.SUPER_ADMIN });
          } catch (err: any) {
            expect(err.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
