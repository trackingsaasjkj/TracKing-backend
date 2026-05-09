import { IsDateString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ReporteFinancieroHibridoQueryDto {
  @ApiPropertyOptional({ example: '2025-01-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2025-01-31' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
