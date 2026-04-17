import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthRepository } from '../../infrastructure/auth.repository';
import { TokenService } from '../../domain/token.service';
import { LoginDto } from '../dto/login.dto';
import { JwtPayload } from '../../../../core/types/jwt-payload.type';
import { Role } from '../../../../core/constants/roles.enum';
import { TokenType } from '@prisma/client';
import { AppException } from '../../../../core/errors/app.exception';
import { HttpStatus } from '@nestjs/common';

@Injectable()
export class LoginUseCase {
  constructor(
    private readonly authRepo: AuthRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(dto: LoginDto) {
    const user = await this.authRepo.findUserByEmailWithCompany(dto.email);

    if (!user) throw new UnauthorizedException('Credenciales inválidas');
    if (user.status !== 'ACTIVE') {
      throw new AppException('Cuenta suspendida', HttpStatus.FORBIDDEN);
    }

    // Req 8: verificar empresa suspendida (omitir para SUPER_ADMIN sin empresa)
    if (user.company_id !== null && user.company && !user.company.status) {
      throw new AppException('Empresa suspendida', HttpStatus.FORBIDDEN);
    }

    // Req 7: verificar lockout con columna dedicada
    if (user.locked_until && user.locked_until > new Date()) {
      throw new AppException('Cuenta bloqueada temporalmente', HttpStatus.TOO_MANY_REQUESTS);
    }

    const valid = await this.tokenService.comparePassword(dto.password, user.password_hash);
    if (!valid) {
      await this.authRepo.incrementFailedAttempts(user.id);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Login exitoso: resetear contador
    await this.authRepo.resetFailedAttempts(user.id);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as Role,
      company_id: user.company_id,
      ...(user.role === Role.AUX && { permissions: user.permissions ?? [] }),
    };

    const accessToken = this.tokenService.generateAccessToken(payload);
    const refreshToken = this.tokenService.generateRefreshToken(payload);
    const refreshHash = await this.tokenService.hashToken(refreshToken);

    await this.authRepo.saveToken({
      user_id: user.id,
      company_id: user.company_id,
      type: TokenType.REFRESH,
      token_hash: refreshHash,
      expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        company_id: user.company_id,
        ...(user.role === Role.AUX && { permissions: user.permissions ?? [] }),
      },
    };
  }
}
