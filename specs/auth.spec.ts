import * as fc from 'fast-check';
import { UnauthorizedException, HttpStatus } from '@nestjs/common';
import { TokenType } from '@prisma/client';

import { LoginUseCase } from '../src/modules/auth/application/use-cases/login.use-case';
import { LogoutUseCase } from '../src/modules/auth/application/use-cases/logout.use-case';
import { RefreshTokenUseCase } from '../src/modules/auth/application/use-cases/refresh-token.use-case';
import { AppException } from '../src/core/errors/app.exception';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-id-1',
    name: 'Test User',
    email: 'test@example.com',
    password_hash: '$2b$12$hashedpassword',
    role: 'ADMIN',
    status: 'ACTIVE',
    company_id: 'company-id-1',
    failed_attempts: 0,
    locked_until: null,
    company: { id: 'company-id-1', status: true },
    ...overrides,
  };
}

// ─── 4.1 Mock AuthRepository ─────────────────────────────────────────────────

function makeAuthRepo() {
  return {
    findUserByEmailWithCompany: jest.fn(),
    findUserById: jest.fn(),
    findRefreshToken: jest.fn(),
    markTokenUsed: jest.fn(),
    saveToken: jest.fn(),
    revokeAllUserTokens: jest.fn(),
    incrementFailedAttempts: jest.fn(),
    resetFailedAttempts: jest.fn(),
  } as any;
}

// ─── 4.2 Mock TokenService ────────────────────────────────────────────────────

function makeTokenService() {
  return {
    comparePassword: jest.fn(),
    generateAccessToken: jest.fn().mockReturnValue('access-token'),
    generateRefreshToken: jest.fn().mockReturnValue('refresh-token'),
    hashToken: jest.fn().mockResolvedValue('hashed-token'),
    verifyRefreshToken: jest.fn(),
  } as any;
}

// ─── LoginUseCase ─────────────────────────────────────────────────────────────

describe('LoginUseCase', () => {
  let useCase: LoginUseCase;
  let mockRepo: ReturnType<typeof makeAuthRepo>;
  let mockTokenService: ReturnType<typeof makeTokenService>;

  beforeEach(() => {
    mockRepo = makeAuthRepo();
    mockTokenService = makeTokenService();
    useCase = new LoginUseCase(mockRepo, mockTokenService);
  });

  // 4.3 Login exitoso retorna { accessToken, refreshToken, user }
  it('login exitoso retorna { accessToken, refreshToken, user }', async () => {
    const user = makeUser();
    mockRepo.findUserByEmailWithCompany.mockResolvedValue(user);
    mockTokenService.comparePassword.mockResolvedValue(true);

    const result = await useCase.execute({ email: user.email, password: 'correct-password' });

    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
    expect(result).toHaveProperty('user');
    expect(result.user).toMatchObject({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      company_id: user.company_id,
    });
  });

  // 4.4 Email no encontrado → UnauthorizedException
  it('email no encontrado → UnauthorizedException', async () => {
    mockRepo.findUserByEmailWithCompany.mockResolvedValue(null);

    await expect(
      useCase.execute({ email: 'notfound@example.com', password: 'any' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  // 4.5 Contraseña incorrecta → UnauthorizedException + llama incrementFailedAttempts
  it('contraseña incorrecta → UnauthorizedException y llama incrementFailedAttempts', async () => {
    const user = makeUser();
    mockRepo.findUserByEmailWithCompany.mockResolvedValue(user);
    mockTokenService.comparePassword.mockResolvedValue(false);
    mockRepo.incrementFailedAttempts.mockResolvedValue(undefined);

    await expect(
      useCase.execute({ email: user.email, password: 'wrong-password' }),
    ).rejects.toThrow(UnauthorizedException);

    expect(mockRepo.incrementFailedAttempts).toHaveBeenCalledWith(user.id);
  });

  // 4.6 user.status = SUSPENDED → AppException 403
  it('user.status = SUSPENDED → AppException 403', async () => {
    const user = makeUser({ status: 'SUSPENDED' });
    mockRepo.findUserByEmailWithCompany.mockResolvedValue(user);

    await expect(
      useCase.execute({ email: user.email, password: 'any' }),
    ).rejects.toThrow(AppException);

    await expect(
      useCase.execute({ email: user.email, password: 'any' }),
    ).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
  });

  // 4.7 company.status = false → AppException 403 "Empresa suspendida"
  it('company.status = false → AppException 403 "Empresa suspendida"', async () => {
    const user = makeUser({ company: { id: 'company-id-1', status: false } });
    mockRepo.findUserByEmailWithCompany.mockResolvedValue(user);

    let thrown: unknown;
    try {
      await useCase.execute({ email: user.email, password: 'any' });
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(AppException);
    expect((thrown as AppException).getStatus()).toBe(HttpStatus.FORBIDDEN);
    const body = (thrown as AppException).getResponse() as { error: string };
    expect(body.error).toBe('Empresa suspendida');
  });

  // 4.8 locked_until > now() → AppException 429
  it('locked_until > now() → AppException 429', async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000);
    const user = makeUser({ locked_until: futureDate });
    mockRepo.findUserByEmailWithCompany.mockResolvedValue(user);

    let thrown: unknown;
    try {
      await useCase.execute({ email: user.email, password: 'any' });
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(AppException);
    expect((thrown as AppException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
  });

  // 4.9 Login exitoso llama resetFailedAttempts
  it('login exitoso llama resetFailedAttempts', async () => {
    const user = makeUser();
    mockRepo.findUserByEmailWithCompany.mockResolvedValue(user);
    mockTokenService.comparePassword.mockResolvedValue(true);
    mockRepo.resetFailedAttempts.mockResolvedValue(undefined);

    await useCase.execute({ email: user.email, password: 'correct-password' });

    expect(mockRepo.resetFailedAttempts).toHaveBeenCalledWith(user.id);
  });

  // 2.1 Rol AUX → JWT payload incluye permissions[] con los permisos del usuario
  // Validates: Requirements 2.1
  it('rol AUX → generateAccessToken recibe payload con permissions[]', async () => {
    const user = makeUser({
      role: 'AUX',
      permissions: ['VER_SERVICIOS', 'CREAR_SERVICIOS'],
    });
    mockRepo.findUserByEmailWithCompany.mockResolvedValue(user);
    mockTokenService.comparePassword.mockResolvedValue(true);

    await useCase.execute({ email: user.email, password: 'correct-password' });

    const callArg = mockTokenService.generateAccessToken.mock.calls[0][0];
    expect(callArg).toHaveProperty('permissions');
    expect(callArg.permissions).toEqual(['VER_SERVICIOS', 'CREAR_SERVICIOS']);
  });

  // 2.2 Rol ADMIN → JWT payload NO incluye permissions (o array vacío)
  // Validates: Requirements 2.2
  it('rol ADMIN → generateAccessToken recibe payload sin permissions', async () => {
    const user = makeUser({ role: 'ADMIN' });
    mockRepo.findUserByEmailWithCompany.mockResolvedValue(user);
    mockTokenService.comparePassword.mockResolvedValue(true);

    await useCase.execute({ email: user.email, password: 'correct-password' });

    const callArg = mockTokenService.generateAccessToken.mock.calls[0][0];
    // ADMIN should not have permissions in the payload
    expect(callArg.permissions).toBeUndefined();
  });

  // 4.13 PBT: fc.string() como password → siempre UnauthorizedException cuando no coincide con hash
  // Validates: Requirements 1.4
  it('P-1: cualquier contraseña incorrecta → siempre UnauthorizedException', async () => {
    const user = makeUser();
    mockRepo.findUserByEmailWithCompany.mockResolvedValue(user);
    mockRepo.incrementFailedAttempts.mockResolvedValue(undefined);

    await fc.assert(
      fc.asyncProperty(fc.string(), async (password) => {
        // comparePassword always returns false (password never matches)
        mockTokenService.comparePassword.mockResolvedValue(false);

        await expect(
          useCase.execute({ email: user.email, password }),
        ).rejects.toThrow(UnauthorizedException);
      }),
      { numRuns: 100 },
    );
  });
});

// ─── RefreshTokenUseCase ──────────────────────────────────────────────────────

describe('RefreshTokenUseCase', () => {
  let useCase: RefreshTokenUseCase;
  let mockRepo: ReturnType<typeof makeAuthRepo>;
  let mockTokenService: ReturnType<typeof makeTokenService>;

  beforeEach(() => {
    mockRepo = makeAuthRepo();
    mockTokenService = makeTokenService();
    useCase = new RefreshTokenUseCase(mockRepo, mockTokenService);
  });

  // 4.10 Refresh token válido retorna nuevos tokens
  it('refresh token válido retorna nuevos tokens', async () => {
    const user = makeUser();
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      company_id: user.company_id,
    };
    const storedToken = { id: 'token-id-1', used: false };

    mockTokenService.verifyRefreshToken.mockReturnValue(payload);
    mockTokenService.hashToken.mockResolvedValue('hashed-refresh-token');
    mockRepo.findRefreshToken.mockResolvedValue(storedToken);
    mockRepo.markTokenUsed.mockResolvedValue(undefined);
    mockRepo.findUserById.mockResolvedValue(user);
    mockRepo.saveToken.mockResolvedValue(undefined);

    const result = await useCase.execute('valid-refresh-token');

    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
  });

  // 4.11 Refresh token ya usado → UnauthorizedException
  it('refresh token ya usado → UnauthorizedException', async () => {
    const payload = {
      sub: 'user-id-1',
      email: 'test@example.com',
      role: 'ADMIN',
      company_id: 'company-id-1',
    };

    mockTokenService.verifyRefreshToken.mockReturnValue(payload);
    mockTokenService.hashToken.mockResolvedValue('hashed-token');
    // findRefreshToken returns null → token already used or not found
    mockRepo.findRefreshToken.mockResolvedValue(null);

    await expect(useCase.execute('used-refresh-token')).rejects.toThrow(UnauthorizedException);
  });
});

// ─── LogoutUseCase ────────────────────────────────────────────────────────────

describe('LogoutUseCase', () => {
  let useCase: LogoutUseCase;
  let mockRepo: ReturnType<typeof makeAuthRepo>;

  beforeEach(() => {
    mockRepo = makeAuthRepo();
    useCase = new LogoutUseCase(mockRepo);
  });

  // 4.12 Logout llama revokeAllUserTokens
  it('logout llama revokeAllUserTokens con userId y companyId', async () => {
    mockRepo.revokeAllUserTokens.mockResolvedValue(undefined);

    await useCase.execute('user-id-1', 'company-id-1');

    expect(mockRepo.revokeAllUserTokens).toHaveBeenCalledWith('user-id-1', 'company-id-1');
  });
});
