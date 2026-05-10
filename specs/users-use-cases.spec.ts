/**
 * Property-Based Tests — UsersUseCases
 * specs/users-use-cases.spec.ts
 *
 * Property 3: Round-trip de permisos       — Validates: Requirements 3.7, 8.1
 * Property 4: Idempotencia de update       — Validates: Requirements 4.3
 * Property 5: Aislamiento de roles no-AUX  — Validates: Requirements 3.6, 4.4
 */
import * as fc from 'fast-check';
import { UsersUseCases } from '../src/modules/users/application/use-cases/users.use-cases';
import { Role } from '../src/core/constants/roles.enum';
import { Permission } from '../src/core/constants/permissions.enum';

// ─── Mock factories ───────────────────────────────────────────────────────────

function makeUsersRepo() {
  return {
    findAll: jest.fn(),
    findById: jest.fn(),
    findByEmail: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  } as any;
}

function makeTokenService() {
  return {
    hashPassword: jest.fn().mockResolvedValue('hashed_password'),
    verifyToken: jest.fn(),
    generateToken: jest.fn(),
  } as any;
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const allPermissions = Object.values(Permission);

/** Generates a valid (possibly empty) subset of Permission values */
const permissionsArb = fc.array(fc.constantFrom(...allPermissions), {
  minLength: 0,
  maxLength: allPermissions.length,
}).map((arr) => [...new Set(arr)] as Permission[]);

/** Generates a non-AUX role */
const nonAuxRoleArb = fc.constantFrom(Role.ADMIN, Role.COURIER);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeBaseUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-uuid',
    name: 'Test User',
    email: 'test@empresa.com',
    role: Role.AUX,
    status: 'ACTIVE',
    created_at: new Date(),
    permissions: [],
    ...overrides,
  };
}

// ─── Property 3: Round-trip de permisos ──────────────────────────────────────

describe('P3: Round-trip de permisos — create(AUX, P) → repo.create recibe P (PBT)', () => {
  /**
   * **Validates: Requirements 3.7, 8.1**
   *
   * For any valid permissions array P, when creating an AUX user with those
   * permissions, the repository's create method should be called with exactly
   * those permissions. Then findById returns the same permissions.
   */
  it('P3: create(AUX, P) → usersRepo.create es llamado con permissions = P', async () => {
    await fc.assert(
      fc.asyncProperty(
        permissionsArb,
        async (permissions) => {
          const repo = makeUsersRepo();
          const tokenService = makeTokenService();
          const useCase = new UsersUseCases(repo, tokenService, { company: { findUnique: jest.fn() } } as any);

          // No existing user (no conflict)
          repo.findByEmail.mockResolvedValue(null);

          const createdUser = makeBaseUser({ permissions });
          repo.create.mockResolvedValue(createdUser);

          const dto = {
            name: 'Test AUX',
            email: 'aux@empresa.com',
            password: 'password123',
            role: Role.AUX,
            permissions,
          };

          await useCase.create(dto, 'company-uuid');

          expect(repo.create).toHaveBeenCalledWith(
            expect.objectContaining({ permissions }),
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('P3b: create(AUX, P) → findById retorna user.permissions equivalente a P', async () => {
    await fc.assert(
      fc.asyncProperty(
        permissionsArb,
        async (permissions) => {
          const repo = makeUsersRepo();
          const tokenService = makeTokenService();
          const useCase = new UsersUseCases(repo, tokenService, { company: { findUnique: jest.fn() } } as any);

          repo.findByEmail.mockResolvedValue(null);

          const createdUser = makeBaseUser({ permissions });
          repo.create.mockResolvedValue(createdUser);

          // findById returns the same user that was created
          repo.findById.mockResolvedValue(createdUser);

          const dto = {
            name: 'Test AUX',
            email: 'aux@empresa.com',
            password: 'password123',
            role: Role.AUX,
            permissions,
          };

          await useCase.create(dto, 'company-uuid');
          const found = await useCase.findById('user-uuid', 'company-uuid');

          expect(found.permissions).toEqual(permissions);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 4: Idempotencia de update ──────────────────────────────────────

describe('P4: Idempotencia de update — update(P) dos veces produce el mismo estado (PBT)', () => {
  /**
   * **Validates: Requirements 4.3**
   *
   * For any permissions array P, calling update twice with the same permissions
   * should result in the same final state (the repository update is called with
   * the same data both times).
   */
  it('P4: update(AUX, P) dos veces → repo.update recibe los mismos datos en ambas llamadas', async () => {
    await fc.assert(
      fc.asyncProperty(
        permissionsArb,
        async (permissions) => {
          const repo = makeUsersRepo();
          const tokenService = makeTokenService();
          const useCase = new UsersUseCases(repo, tokenService, { company: { findUnique: jest.fn() } } as any);

          const existingUser = makeBaseUser({ permissions: [] });
          repo.findById.mockResolvedValue(existingUser);

          const updatedUser = makeBaseUser({ permissions });
          repo.update.mockResolvedValue(updatedUser);

          const dto = { permissions, role: Role.AUX };

          // First update
          await useCase.update('user-uuid', dto, 'company-uuid');
          // Second update with same dto
          await useCase.update('user-uuid', dto, 'company-uuid');

          const calls = repo.update.mock.calls;
          expect(calls).toHaveLength(2);

          // Both calls should pass the same permissions
          const firstCallData = calls[0][2];
          const secondCallData = calls[1][2];
          expect(firstCallData.permissions).toEqual(secondCallData.permissions);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 5: Aislamiento de roles no-AUX ─────────────────────────────────

describe('P5: Aislamiento de roles no-AUX — create/update persisten permissions=[] (PBT)', () => {
  /**
   * **Validates: Requirements 3.6, 4.4**
   *
   * For any non-AUX role (ADMIN, COURIER), create() should always pass
   * permissions=[] to the repository regardless of what permissions are in the DTO.
   * For update(), when targetRole is not AUX, permissions should be stripped.
   */
  it('P5a: create(non-AUX, P) → repo.create es llamado con permissions = []', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonAuxRoleArb,
        permissionsArb,
        async (role, permissions) => {
          const repo = makeUsersRepo();
          const tokenService = makeTokenService();
          const useCase = new UsersUseCases(repo, tokenService, { company: { findUnique: jest.fn() } } as any);

          repo.findByEmail.mockResolvedValue(null);
          repo.create.mockResolvedValue(makeBaseUser({ role, permissions: [] }));

          const dto = {
            name: 'Test User',
            email: 'user@empresa.com',
            password: 'password123',
            role,
            permissions,
          };

          await useCase.create(dto, 'company-uuid');

          expect(repo.create).toHaveBeenCalledWith(
            expect.objectContaining({ permissions: [] }),
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('P5b: update(non-AUX, P) → repo.update es llamado sin el campo permissions', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonAuxRoleArb,
        permissionsArb,
        async (role, permissions) => {
          const repo = makeUsersRepo();
          const tokenService = makeTokenService();
          const useCase = new UsersUseCases(repo, tokenService, { company: { findUnique: jest.fn() } } as any);

          const existingUser = makeBaseUser({ role });
          repo.findById.mockResolvedValue(existingUser);
          repo.update.mockResolvedValue(existingUser);

          const dto = { role, permissions };

          await useCase.update('user-uuid', dto, 'company-uuid');

          const updateCallData = repo.update.mock.calls[0][2];
          expect(updateCallData).not.toHaveProperty('permissions');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('P5c: update sin role explícito cuando user.role es non-AUX → permissions eliminado', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonAuxRoleArb,
        permissionsArb,
        async (role, permissions) => {
          const repo = makeUsersRepo();
          const tokenService = makeTokenService();
          const useCase = new UsersUseCases(repo, tokenService, { company: { findUnique: jest.fn() } } as any);

          // Existing user already has a non-AUX role
          const existingUser = makeBaseUser({ role });
          repo.findById.mockResolvedValue(existingUser);
          repo.update.mockResolvedValue(existingUser);

          // DTO does not specify role — targetRole falls back to user.role (non-AUX)
          const dto = { permissions };

          await useCase.update('user-uuid', dto, 'company-uuid');

          const updateCallData = repo.update.mock.calls[0][2];
          expect(updateCallData).not.toHaveProperty('permissions');
        },
      ),
      { numRuns: 100 },
    );
  });
});
