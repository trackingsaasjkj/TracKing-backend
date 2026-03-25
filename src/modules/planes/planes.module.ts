import { Module } from '@nestjs/common';
import { PlanesController } from './planes.controller';
import { PlanesUseCases } from './application/use-cases/planes.use-cases';
import { PlanesRepository } from './infrastructure/planes.repository';

@Module({
  controllers: [PlanesController],
  providers: [PlanesUseCases, PlanesRepository],
  exports: [PlanesRepository],
})
export class PlanesModule {}
