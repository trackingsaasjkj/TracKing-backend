import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { GlobalSearchUseCase } from './application/use-cases/global-search.use-case';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { GooglePlacesModule } from './providers/google-places/google-places.module';
import { MapboxModule } from './providers/mapbox/mapbox.module';
import { SearchSessionService } from './providers/session/search-session.service';

@Module({
  imports: [PrismaModule, GooglePlacesModule, MapboxModule],
  controllers: [SearchController],
  providers: [SearchService, GlobalSearchUseCase, SearchSessionService],
  exports: [SearchService, SearchSessionService],
})
export class SearchModule {}
