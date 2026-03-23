import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersUseCases } from './application/use-cases/customers.use-cases';
import { CustomersRepository } from './infrastructure/customers.repository';

@Module({
  controllers: [CustomersController],
  providers: [CustomersUseCases, CustomersRepository],
  exports: [CustomersRepository],
})
export class CustomersModule {}
