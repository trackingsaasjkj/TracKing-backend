import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { RegisterUseCase } from './application/use-cases/register.use-case';
import { LogoutUseCase } from './application/use-cases/logout.use-case';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token.use-case';
import { LoginDto } from './application/dto/login.dto';
import { RegisterDto } from './application/dto/register.dto';
import { Public } from '../../core/decorators/public.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { JwtPayload } from '../../core/types/jwt-payload.type';
import { ok } from '../../core/utils/response.util';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// En producción el frontend (Vercel) y el backend (Render) son cross-origin.
// Para que las cookies viajen en peticiones cross-origin se requiere:
//   sameSite: 'none' + secure: true
// En local (same-site) se usa 'lax' para no requerir HTTPS.
const COOKIE_OPTIONS: { httpOnly: boolean; secure: boolean; sameSite: 'lax' | 'strict' | 'none'; maxAge: number } = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: IS_PRODUCTION ? 'none' : 'lax',
  maxAge: 15 * 60 * 1000,
};

@ApiTags('Auth')
@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly registerUseCase: RegisterUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
  ) {}

  @Public()
  @Post('login')
  @Throttle({ auth: { ttl: 60_000, limit: 1000 } })
  @ApiOperation({ summary: 'Iniciar sesión', description: 'Retorna datos del usuario y establece cookies httpOnly con access_token y refresh_token.' })
  @ApiResponse({ status: 200, description: 'Login exitoso' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  @ApiResponse({ status: 429, description: 'Cuenta bloqueada por múltiples intentos fallidos' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.loginUseCase.execute(dto);
    console.log('[Login] Result from useCase:', {
      hasAccessToken: !!result.accessToken,
      hasRefreshToken: !!result.refreshToken,
      accessTokenLength: result.accessToken?.length ?? 0,
      refreshTokenLength: result.refreshToken?.length ?? 0,
    });
    res.cookie('access_token', result.accessToken, COOKIE_OPTIONS);
    res.cookie('refresh_token', result.refreshToken, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 });
    const response = { ...result.user, accessToken: result.accessToken, refreshToken: result.refreshToken };
    console.log('[Login] Response to client:', {
      hasAccessToken: !!response.accessToken,
      hasRefreshToken: !!response.refreshToken,
      accessTokenLength: response.accessToken?.length ?? 0,
      refreshTokenLength: response.refreshToken?.length ?? 0,
    });
    return ok(response);
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Registrar usuario', description: 'Crea un usuario en la empresa indicada y establece cookies de sesión.' })
  @ApiResponse({ status: 201, description: 'Usuario registrado' })
  @ApiResponse({ status: 409, description: 'Email ya registrado en esta empresa' })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.registerUseCase.execute(dto);
    res.cookie('access_token', result.accessToken, COOKIE_OPTIONS);
    res.cookie('refresh_token', result.refreshToken, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 });
    return ok({ ...result.user, accessToken: result.accessToken, refreshToken: result.refreshToken });
  }

  @Post('logout')
  @ApiOperation({ summary: 'Cerrar sesión', description: 'Revoca todos los tokens activos y limpia las cookies.' })
  @ApiResponse({ status: 200, description: 'Sesión cerrada' })
  async logout(@CurrentUser() user: JwtPayload, @Res({ passthrough: true }) res: Response) {
    await this.logoutUseCase.execute(user.sub, user.company_id!);
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    return ok(null);
  }

  @Public()
  @Post('refresh')
  @Throttle({ auth: { ttl: 60_000, limit: 1000 } })
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Renovar tokens', description: 'Usa el refresh_token de la cookie para emitir nuevos tokens. El refresh token es de un solo uso.' })
  @ApiResponse({ status: 200, description: 'Tokens renovados' })
  @ApiResponse({ status: 401, description: 'Refresh token inválido o ya utilizado' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body?: { refreshToken?: string }) {
    // Accept refresh token from:
    // 1. Cookie (same-origin)
    // 2. Authorization header (cross-origin)
    // 3. Body (mobile)
    const token =
      req.cookies?.refresh_token ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : undefined) ||
      body?.refreshToken;
    
    console.log('[Refresh] Endpoint called, token source:', {
      fromCookie: !!req.cookies?.refresh_token,
      fromHeader: !!req.headers.authorization?.startsWith('Bearer '),
      fromBody: !!body?.refreshToken,
      tokenLength: token?.length ?? 0,
      tokenStart: token?.substring(0, 20) ?? 'null'
    });
    
    const result = await this.refreshTokenUseCase.execute(token);
    res.cookie('access_token', result.accessToken, COOKIE_OPTIONS);
    res.cookie('refresh_token', result.refreshToken, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 });
    return ok({ accessToken: result.accessToken, refreshToken: result.refreshToken });
  }
}
