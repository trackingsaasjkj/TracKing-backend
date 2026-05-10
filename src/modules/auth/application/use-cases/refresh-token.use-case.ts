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
    console.log('[RefreshToken] Starting refresh token validation');
    console.log('[RefreshToken] Raw token length:', rawRefreshToken?.length ?? 0);
    console.log('[RefreshToken] Raw token start:', rawRefreshToken?.substring(0, 20) ?? 'null');
    
    let payload: JwtPayload;
    try {
      payload = this.tokenService.verifyRefreshToken(rawRefreshToken);
      console.log('[RefreshToken] Token verified, payload:', { sub: payload.sub, company_id: payload.company_id });
    } catch (err) {
      console.error('[RefreshToken] Token verification failed:', err);
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    // IMPORTANTE: Buscar el token en TEXTO PLANO (no hasheado)
    // El campo token_hash contiene el token en texto plano
    console.log('[RefreshToken] Searching in DB with:', { 
      user_id: payload.sub, 
      company_id: payload.company_id,
      type: 'REFRESH',
      used: false
    });
    
    const stored = await this.authRepo.findRefreshToken(rawRefreshToken, payload.sub, payload.company_id);
    console.log('[RefreshToken] DB search result:', { found: !!stored, used: stored?.used });

    if (!stored) {
      console.error('[RefreshToken] Token not found in DB or already used');
      throw new UnauthorizedException('Refresh token no válido o ya utilizado');
    }

    const user = await this.authRepo.findUserById(payload.sub, payload.company_id);
    if (!user || user.status !== 'ACTIVE') {
      console.error('[RefreshToken] User not found or inactive');
      throw new UnauthorizedException('Usuario inactivo');
    }

    const newPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as Role,
      company_id: user.company_id,
    };

    const accessToken = this.tokenService.generateAccessToken(newPayload);
    const newRefreshToken = this.tokenService.generateRefreshToken(newPayload);

    console.log('[RefreshToken] New tokens generated, saving to DB');
    
    // FIX: Guardar nuevo token ANTES de marcar el viejo como usado
    // Esto evita race conditions donde el token se marca como usado pero no hay nuevo token disponible
    await this.authRepo.saveToken({
      user_id: user.id,
      company_id: user.company_id,
      type: TokenType.REFRESH,
      token_hash: newRefreshToken, // Guardar el token en texto plano
      expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    console.log('[RefreshToken] New token saved, marking old token as used');
    
    // Single-use: mark as used AFTER new token is saved
    await this.authRepo.markTokenUsed(stored.id);

    console.log('[RefreshToken] Refresh completed successfully');
    
    return { accessToken, refreshToken: newRefreshToken };
  }
}
