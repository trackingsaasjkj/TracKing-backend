import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthRepository } from '../../infrastructure/auth.repository';
import { TokenService } from '../../domain/token.service';
import { LoginDto } from '../dto/login.dto';
import { JwtPayload } from '../../../../core/types/jwt-payload.type';
import { Role } from '../../../../core/constants/roles.enum';
import { TokenType } from '@prisma/client';
import { AppException } from '../../../../core/errors/app.exception';
import { HttpStatus } from '@nestjs/common';

const MAX_FAILED_ATTEMPTS = 5;

@Injectable()
export class LoginUseCase {
  constructor(
    private readonly authRepo: AuthRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(dto: LoginDto) {
    const user = await this.authRepo.findUserByEmail(dto.email, dto.company_id);

    if (!user) throw new UnauthorizedException('Credenciales inválidas');
    if (user.status !== 'ACTIVE') {
      throw new AppException('Cuenta suspendida', HttpStatus.FORBIDDEN);
    }

    // Lockout check (5 failed attempts tracked via token records)
    const failedCount = await this.authRepo.countRecentFailedLogins(user.id, dto.company_id);
    if (failedCount >= MAX_FAILED_ATTEMPTS) {
      throw new AppException('Cuenta bloqueada temporalmente por múltiples intentos fallidos', HttpStatus.TOO_MANY_REQUESTS);
    }

    const valid = await this.tokenService.comparePassword(dto.password, user.password_hash);
    if (!valid) {
      // Record failed attempt as a used ACCESS token (sentinel)
      await this.authRepo.saveToken({
        user_id: user.id,
        company_id: dto.company_id,
        type: TokenType.ACCESS,
        token_hash: 'FAILED_ATTEMPT',
        expiration: new Date(Date.now() + 60 * 60 * 1000),
      });
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as Role,
      company_id: user.company_id,
    };

    const accessToken = this.tokenService.generateAccessToken(payload);
    const refreshToken = this.tokenService.generateRefreshToken(payload);
    const refreshHash = await this.tokenService.hashToken(refreshToken);

    await this.authRepo.saveToken({
      user_id: user.id,
      company_id: dto.company_id,
      type: TokenType.REFRESH,
      token_hash: refreshHash,
      expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, company_id: user.company_id },
    };
  }
}
