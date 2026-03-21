import { IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerarLiquidacionClienteDto {
  @ApiProperty({ example: '2025-01-01', description: 'Fecha inicio (ISO date)' })
  @IsDateString()
  start_date!: string;

  @ApiProperty({ example: '2025-01-31', description: 'Fecha fin (ISO date)' })
  @IsDateString()
  end_date!: string;
}
