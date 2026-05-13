import { Module } from '@nestjs/common';
import { MapboxService } from './mapbox.service';
import { CacheModule } from '../../../../infrastructure/cache/cache.module';

@Module({
  imports: [CacheModule],
  providers: [MapboxService],
  exports: [MapboxService],
})
export class MapboxModule {}
