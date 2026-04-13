import * as fc from 'fast-check';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '../src/core/guards/permissions.guard';
import { Role } from '../src/core/constants/roles.enum';
import { Permission } from '../src/core/constants/permissions.enum';
import { PERMISSIONS_KEY } from '../src/core/decorators/permissions.decorator';

const ALL_PERMISSIONS = Object.values(Permission);

function makeContext(
  role: Role,
  permissions: string[],
  requiredPermissions: Permission[],
): any {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        user: {
          sub: 'test-id',
          email: 'test@test.com',
          role,
          company_id: 'company-1',
          permissions,
        },
      }),
    }),
  };
}

function makeReflector(requiredPermissions: Permission[]): Reflector {
  return {
    getAllAndOverride: (_key: string, _targets: any[]) => requiredPermissions,
  } as unknown as Reflector;
}

describe('PermissionsGuard — Property-Based Tests', () => {
  // Property 1: Invariante de permisos por rol
  // Validates: Requirements 1.4
  it('P1: ADMIN/SUPER_ADMIN siempre pueden activar sin importar los permisos requeridos', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(Role.ADMIN, Role.SUPER_ADMIN),
        fc.array(fc.constantFrom(...ALL_PERMISSIONS), { minLength: 1, maxLength: ALL_PERMISSIONS.length }),
        (role, requiredPermissions) => {
          const reflector = makeReflector(requiredPermissions as Permission[]);
          const guard = new PermissionsGuard(reflector);
          const context = makeContext(role, [], requiredPermissions as Permission[]);

          const result = guard.canActivate(context);
          expect(result).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });

  // Property 2: Invariante de aislamiento
  // Validates: Requirements 1.6, 7.6
  it('P2: AUX con permissions=[] siempre lanza ForbiddenException para endpoints protegidos', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...ALL_PERMISSIONS), { minLength: 1, maxLength: ALL_PERMISSIONS.length }),
        (requiredPermissions) => {
          const reflector = makeReflector(requiredPermissions as Permission[]);
          const guard = new PermissionsGuard(reflector);
          const context = makeContext(Role.AUX, [], requiredPermissions as Permission[]);

          expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
        },
      ),
      { numRuns: 200 },
    );
  });
});
