import { IsString, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerarLiquidacionClienteDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440010' })
  @IsString()
  customer_id!: string;

  @ApiProperty({ example: '2025-01-01' })
  @IsDateString()
  start_date!: string;

  @ApiProperty({ example: '2025-01-31' })
  @IsDateString()
  end_date!: string;
}
