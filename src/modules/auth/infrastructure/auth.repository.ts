import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { TokenType } from '@prisma/client';

export interface UserWithCompany {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  company_id: string | null;
  password_hash: string;
  failed_attempts: number;
  locked_until: Date | null;
  permissions: string[];
  company: { id: string; status: boolean } | null;
}

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByEmail(email: string, company_id?: string | null) {
    if (company_id !== undefined) {
      return this.prisma.user.findFirst({ where: { email, company_id } });
    }
    return this.prisma.user.findFirst({ where: { email } });
  }

  async findUserByEmailWithCompany(email: string): Promise<UserWithCompany | null> {
    return this.prisma.user.findFirst({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        company_id: true,
        password_hash: true,
        failed_attempts: true,
        locked_until: true,
        permissions: true,
        company: {
          select: { id: true, status: true },
        },
      },
    }) as Promise<UserWithCompany | null>;
  }

  async findUserById(id: string, company_id: string | null) {
    return this.prisma.user.findFirst({ where: { id, company_id } });
  }

  async incrementFailedAttempts(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { failed_attempts: true },
    });

    const newCount = (user?.failed_attempts ?? 0) + 1;
    const lockedUntil = newCount >= 5 ? new Date(Date.now() + 60 * 60 * 1000) : undefined;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failed_attempts: newCount,
        ...(lockedUntil !== undefined && { locked_until: lockedUntil }),
      },
    });
  }

  async resetFailedAttempts(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { failed_attempts: 0, locked_until: null },
    });
  }

  /**
   * @deprecated Use `failed_attempts` column directly via `incrementFailedAttempts`.
   * Kept for compatibility.
   */
  async countRecentFailedLogins(userId: string, company_id: string | null): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return this.prisma.token.count({
      where: {
        user_id: userId,
        company_id,
        type: TokenType.ACCESS,
        token_hash: 'FAILED_ATTEMPT',
        used: false,
        created_at: { gte: oneHourAgo },
      },
    });
  }

  async saveToken(data: {
    user_id: string;
    company_id: string | null;
    type: TokenType;
    token_hash: string;
    expiration: Date;
  }) {
    return this.prisma.token.create({ data });
  }

  async findRefreshToken(token_hash: string, user_id: string, company_id: string | null) {
    return this.prisma.token.findFirst({
      where: { token_hash, user_id, company_id, type: TokenType.REFRESH, used: false },
    });
  }

  async markTokenUsed(id: string): Promise<void> {
    await this.prisma.token.update({ where: { id }, data: { used: true } });
  }

  async revokeAllUserTokens(user_id: string, company_id: string | null): Promise<void> {
    await this.prisma.token.updateMany({
      where: { user_id, company_id, used: false },
      data: { used: true },
    });
  }
}
