import { IsDateString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerarLiquidacionCourierDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002', description: 'UUID del mensajero' })
  @IsUUID()
  courier_id!: string;

  @ApiProperty({ example: '2025-01-01', description: 'Fecha inicio (ISO date)' })
  @IsDateString()
  start_date!: string;

  @ApiProperty({ example: '2025-01-31', description: 'Fecha fin (ISO date)' })
  @IsDateString()
  end_date!: string;
}
