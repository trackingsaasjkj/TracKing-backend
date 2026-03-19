import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { TokenService } from '../../domain/token.service';
import { RegisterDto } from '../dto/register.dto';
import { JwtPayload } from '../../../../core/types/jwt-payload.type';
import { Role } from '../../../../core/constants/roles.enum';
import { TokenType } from '@prisma/client';
import { AuthRepository } from '../../infrastructure/auth.repository';

@Injectable()
export class RegisterUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly authRepo: AuthRepository,
  ) {}

  async execute(dto: RegisterDto) {
    const company = await this.prisma.company.findUnique({ where: { id: dto.company_id } });
    if (!company || !company.status) throw new NotFoundException('Empresa no encontrada o inactiva');

    const existing = await this.authRepo.findUserByEmail(dto.email, dto.company_id);
    if (existing) throw new ConflictException('El email ya está registrado en esta empresa');

    const password_hash = await this.tokenService.hashPassword(dto.password);

    const user = await this.prisma.user.create({
      data: {
        company_id: dto.company_id,
        name: dto.name,
        email: dto.email,
        password_hash,
        role: dto.role,
      },
    });

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
