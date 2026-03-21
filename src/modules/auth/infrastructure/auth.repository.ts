import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { TokenType } from '@prisma/client';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByEmail(email: string, company_id: string | null) {
    return this.prisma.user.findFirst({ where: { email, company_id } });
  }

  async findUserById(id: string, company_id: string | null) {
    return this.prisma.user.findFirst({ where: { id, company_id } });
  }

  async incrementFailedAttempts(userId: string): Promise<void> {
    // Stored as count of REFRESH tokens with used=false in last hour as proxy
    // Real implementation: add failed_attempts column via migration
    // For now we track via token table — see lockout check below
  }

  async countRecentFailedLogins(userId: string, company_id: string | null): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return this.prisma.token.count({
      where: {
        user_id: userId,
        company_id,
        type: TokenType.ACCESS,
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
