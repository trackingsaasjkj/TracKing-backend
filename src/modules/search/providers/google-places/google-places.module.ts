import { Module } from '@nestjs/common';
import { GooglePlacesService } from './google-places.service';
import { GooglePlacesCacheService } from './google-places-cache.service';
import { GooglePlacesDetailsService } from './google-places-details.service';
import { GooglePlacesAnalyticsService } from './google-places-analytics.service';
import { UserAddressHistoryService } from '../user-address-history/user-address-history.service';
import { CacheModule } from '../../../../infrastructure/cache/cache.module';
import { SearchSessionService } from '../session/search-session.service';
import { PrismaModule } from '../../../../infrastructure/database/prisma.module';

@Module({
  imports: [CacheModule, PrismaModule],
  providers: [
    GooglePlacesService,
    GooglePlacesCacheService,
    GooglePlacesDetailsService,
    GooglePlacesAnalyticsService,
    UserAddressHistoryService,
    SearchSessionService,
  ],
  exports: [
    GooglePlacesService,
    GooglePlacesCacheService,
    GooglePlacesDetailsService,
    GooglePlacesAnalyticsService,
    UserAddressHistoryService,
    SearchSessionService,
  ],
})
export class GooglePlacesModule {}
