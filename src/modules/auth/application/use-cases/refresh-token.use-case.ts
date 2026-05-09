import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthRepository } from '../../infrastructure/auth.repository';
import { TokenService } from '../../domain/token.service';
import { JwtPayload } from '../../../../core/types/jwt-payload.type';
import { Role } from '../../../../core/constants/roles.enum';
import { TokenType } from '@prisma/client';

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    private readonly authRepo: AuthRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(rawRefreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = this.tokenService.verifyRefreshToken(rawRefreshToken);
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const refreshHash = await this.tokenService.hashToken(rawRefreshToken);
    const stored = await this.authRepo.findRefreshToken(refreshHash, payload.sub, payload.company_id);

    if (!stored) throw new UnauthorizedException('Refresh token no válido o ya utilizado');

    const user = await this.authRepo.findUserById(payload.sub, payload.company_id);
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException('Usuario inactivo');

    const newPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as Role,
      company_id: user.company_id,
    };

    const accessToken = this.tokenService.generateAccessToken(newPayload);
    const newRefreshToken = this.tokenService.generateRefreshToken(newPayload);
    const newRefreshHash = await this.tokenService.hashToken(newRefreshToken);

    // FIX: Guardar nuevo token ANTES de marcar el viejo como usado
    // Esto evita race conditions donde el token se marca como usado pero no hay nuevo token disponible
    await this.authRepo.saveToken({
      user_id: user.id,
      company_id: user.company_id,
      type: TokenType.REFRESH,
      token_hash: newRefreshHash,
      expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    // Single-use: mark as used AFTER new token is saved
    await this.authRepo.markTokenUsed(stored.id);

    return { accessToken, refreshToken: newRefreshToken };
  }
}
