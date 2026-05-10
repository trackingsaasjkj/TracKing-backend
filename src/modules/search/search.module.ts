import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { GlobalSearchUseCase } from './application/use-cases/global-search.use-case';
import { PrismaModule } from '../../infrastructure/database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SearchController],
  providers: [SearchService, GlobalSearchUseCase],
  exports: [SearchService],
})
export class SearchModule {}
