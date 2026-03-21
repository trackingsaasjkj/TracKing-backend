import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { Public } from '../../core/decorators/public.decorator';

@ApiTags('Health')
@Controller('api/health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Healthcheck', description: 'Verifica el estado del servidor y la base de datos.' })
  check() {
    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prisma, { timeout: 5000 }),
    ]);
  }
}
