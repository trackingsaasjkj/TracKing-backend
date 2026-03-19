import { Injectable } from '@nestjs/common';
import { AuthRepository } from '../../infrastructure/auth.repository';

@Injectable()
export class LogoutUseCase {
  constructor(private readonly authRepo: AuthRepository) {}

  async execute(userId: string, companyId: string): Promise<void> {
    await this.authRepo.revokeAllUserTokens(userId, companyId);
  }
}
