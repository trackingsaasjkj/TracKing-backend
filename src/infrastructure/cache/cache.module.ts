import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { RateLimitService } from './rate-limit.service';

@Global()
@Module({
  providers: [CacheService, RateLimitService],
  exports: [CacheService, RateLimitService],
})
export class CacheModule {}
