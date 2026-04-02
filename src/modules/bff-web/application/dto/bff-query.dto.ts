import { IsDateString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BffReportsQueryDto {
  @ApiProperty({ example: '2026-01-01', description: 'Fecha inicio (ISO date). Requerido.' })
  @IsNotEmpty()
  @IsDateString()
  from!: string;

  @ApiProperty({ example: '2026-01-31T23:59:59', description: 'Fecha fin (ISO date). Requerido.' })
  @IsNotEmpty()
  @IsDateString()
  to!: string;
}

export class BffSettlementsQueryDto {
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440002', description: 'UUID del mensajero (opcional)' })
  @IsOptional()
  @IsUUID()
  courier_id?: string;
}
