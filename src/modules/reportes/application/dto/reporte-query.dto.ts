import { IsDateString, IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ReporteServiciosQueryDto {
  @ApiPropertyOptional({ example: '2025-01-01', description: 'Fecha inicio (ISO date)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2025-01-31', description: 'Fecha fin (ISO date)' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440002', description: 'Filtrar por mensajero' })
  @IsOptional()
  @IsUUID()
  courier_id?: string;
}

export class ReporteFinancieroQueryDto {
  @ApiPropertyOptional({ example: '2025-01-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2025-01-31' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class ReporteFavoritosQueryDto {
  @ApiPropertyOptional({ example: '2025-01-01', description: 'Fecha inicio (ISO date)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2025-01-31', description: 'Fecha fin (ISO date)' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440003', description: 'Filtrar por cliente' })
  @IsOptional()
  @IsUUID()
  customer_id?: string;
}
