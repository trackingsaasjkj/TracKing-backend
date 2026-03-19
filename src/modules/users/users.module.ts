import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersUseCases } from './application/use-cases/users.use-cases';
import { UsersRepository } from './infrastructure/users.repository';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [UsersUseCases, UsersRepository],
  exports: [UsersUseCases, UsersRepository],
})
export class UsersModule {}
