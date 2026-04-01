import { UnauthorizedException } from '@nestjs/common';
import { LoginUseCase } from '../../../modules/auth/application/use-cases/login.use-case';
import { AuthRepository } from '../../../modules/auth/infrastructure/auth.repository';
import { TokenService } from '../../../modules/auth/domain/token.service';

const mockUser = {
  id: 'user-uuid',
  company_id: 'company-uuid',
  email: 'test@test.com',
  password_hash: 'hashed',
  role: 'ADMIN',
  status: 'ACTIVE',
  name: 'Test',
  created_at: new Date(),
  failed_attempts: 0,
  locked_until: null,
  company: { id: 'company-uuid', status: true },
};

const mockAuthRepo = {
  findUserByEmailWithCompany: jest.fn(),
  countRecentFailedLogins: jest.fn().mockResolvedValue(0),
  incrementFailedAttempts: jest.fn().mockResolvedValue(undefined),
  resetFailedAttempts: jest.fn().mockResolvedValue(undefined),
  saveToken: jest.fn(),
} as unknown as AuthRepository;

const mockTokenService = {
  comparePassword: jest.fn(),
  generateAccessToken: jest.fn().mockReturnValue('access-token'),
  generateRefreshToken: jest.fn().mockReturnValue('refresh-token'),
  hashToken: jest.fn().mockResolvedValue('hashed-refresh'),
} as unknown as TokenService;

describe('LoginUseCase', () => {
  let useCase: LoginUseCase;

  beforeEach(() => {
    useCase = new LoginUseCase(mockAuthRepo, mockTokenService);
    jest.clearAllMocks();
    (mockAuthRepo.countRecentFailedLogins as jest.Mock).mockResolvedValue(0);
    (mockAuthRepo.incrementFailedAttempts as jest.Mock).mockResolvedValue(undefined);
    (mockAuthRepo.resetFailedAttempts as jest.Mock).mockResolvedValue(undefined);
  });

  it('should throw if user not found', async () => {
    (mockAuthRepo.findUserByEmailWithCompany as jest.Mock).mockResolvedValue(null);
    await expect(useCase.execute({ email: 'x@x.com', password: '123' }))
      .rejects.toThrow(UnauthorizedException);
  });

  it('should throw if password is wrong', async () => {
    (mockAuthRepo.findUserByEmailWithCompany as jest.Mock).mockResolvedValue(mockUser);
    (mockTokenService.comparePassword as jest.Mock).mockResolvedValue(false);
    await expect(useCase.execute({ email: 'x@x.com', password: 'wrong' }))
      .rejects.toThrow(UnauthorizedException);
  });

  it('should return tokens on valid credentials', async () => {
    (mockAuthRepo.findUserByEmailWithCompany as jest.Mock).mockResolvedValue(mockUser);
    (mockTokenService.comparePassword as jest.Mock).mockResolvedValue(true);
    const result = await useCase.execute({ email: 'test@test.com', password: 'correct' });
    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(result.user.email).toBe('test@test.com');
  });

  it('should block when locked_until is in the future', async () => {
    const lockedUser = {
      ...mockUser,
      locked_until: new Date(Date.now() + 60 * 60 * 1000),
    };
    (mockAuthRepo.findUserByEmailWithCompany as jest.Mock).mockResolvedValue(lockedUser);
    await expect(useCase.execute({ email: 'x@x.com', password: '123' }))
      .rejects.toThrow();
  });
});
