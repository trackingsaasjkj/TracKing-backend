import * as fc from 'fast-check';
import { ForbiddenException } from '@nestjs/common';
import { SuperAdminGuard } from '../../src/core/guards/super-admin.guard';
import { Role } from '../../src/core/constants/roles.enum';

describe('SuperAdminGuard', () => {
  let guard: SuperAdminGuard;

  beforeEach(() => {
    guard = new SuperAdminGuard();
  });

  function makeContext(role: string, company_id: string | null = null) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user: { sub: 'test-id', email: 'test@test.com', role, company_id } }),
      }),
    } as any;
  }

  // Unit tests
  it('should allow SUPER_ADMIN', () => {
    expect(guard.canActivate(makeContext(Role.SUPER_ADMIN))).toBe(true);
  });

  it('should throw ForbiddenException for ADMIN', () => {
    expect(() => guard.canActivate(makeContext(Role.ADMIN))).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException for AUX', () => {
    expect(() => guard.canActivate(makeContext(Role.AUX))).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException for COURIER', () => {
    expect(() => guard.canActivate(makeContext(Role.COURIER))).toThrow(ForbiddenException);
  });

  // Property 2: Guard rechaza roles no-SUPER_ADMIN
  // Validates: Requirements 1.3, 7.2
  it('P2: should reject any non-SUPER_ADMIN role', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(Role.ADMIN, Role.AUX, Role.COURIER),
        (role) => {
          expect(() => guard.canActivate(makeContext(role))).toThrow(ForbiddenException);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Property 3: Guard permite SUPER_ADMIN sin verificar company_id
  // Validates: Requirements 1.6
  it('P3: should allow SUPER_ADMIN regardless of company_id', () => {
    fc.assert(
      fc.property(
        fc.option(fc.uuid(), { nil: null }),
        (company_id) => {
          expect(guard.canActivate(makeContext(Role.SUPER_ADMIN, company_id))).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
