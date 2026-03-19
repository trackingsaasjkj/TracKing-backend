import { UnauthorizedException } from '@nestjs/common';
import { RefreshTokenUseCase } from '../../../modules/auth/application/use-cases/refresh-token.use-case';
import { AuthRepository } from '../../../modules/auth/infrastructure/auth.repository';
import { TokenService } from '../../../modules/auth/domain/token.service';

const mockUser = {
  id: 'user-uuid',
  company_id: 'company-uuid',
  email: 'test@test.com',
  role: 'ADMIN',
  status: 'ACTIVE',
  name: 'Test',
};

const mockPayload = { sub: 'user-uuid', company_id: 'company-uuid', email: 'test@test.com', role: 'ADMIN' };

const mockAuthRepo = {
  findRefreshToken: jest.fn(),
  markTokenUsed: jest.fn(),
  findUserById: jest.fn(),
  saveToken: jest.fn(),
} as unknown as AuthRepository;

const mockTokenService = {
  verifyRefreshToken: jest.fn(),
  hashToken: jest.fn().mockResolvedValue('hashed'),
  generateAccessToken: jest.fn().mockReturnValue('new-access'),
  generateRefreshToken: jest.fn().mockReturnValue('new-refresh'),
} as unknown as TokenService;

describe('RefreshTokenUseCase', () => {
  let useCase: RefreshTokenUseCase;

  beforeEach(() => {
    useCase = new RefreshTokenUseCase(mockAuthRepo, mockTokenService);
    jest.clearAllMocks();
  });

  it('should throw if refresh token is invalid', async () => {
    (mockTokenService.verifyRefreshToken as jest.Mock).mockImplementation(() => { throw new Error(); });
    await expect(useCase.execute('bad-token')).rejects.toThrow(UnauthorizedException);
  });

  it('should throw if token not found in DB (already used)', async () => {
    (mockTokenService.verifyRefreshToken as jest.Mock).mockReturnValue(mockPayload);
    (mockAuthRepo.findRefreshToken as jest.Mock).mockResolvedValue(null);
    await expect(useCase.execute('token')).rejects.toThrow(UnauthorizedException);
  });

  it('should rotate tokens on valid refresh', async () => {
    (mockTokenService.verifyRefreshToken as jest.Mock).mockReturnValue(mockPayload);
    (mockAuthRepo.findRefreshToken as jest.Mock).mockResolvedValue({ id: 'token-id' });
    (mockAuthRepo.findUserById as jest.Mock).mockResolvedValue(mockUser);
    const result = await useCase.execute('valid-token');
    expect(result.accessToken).toBe('new-access');
    expect(result.refreshToken).toBe('new-refresh');
    expect(mockAuthRepo.markTokenUsed).toHaveBeenCalledWith('token-id');
  });
});
