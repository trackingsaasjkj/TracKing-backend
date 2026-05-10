import { IsDateString, IsEnum, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiPropertyOptional({
    enum: ['PERCENTAGE', 'FIXED'],
    example: 'PERCENTAGE',
    description: 'Override del tipo de regla. Si se omite, usa la regla activa de la empresa.',
  })
  @IsOptional()
  @IsEnum(['PERCENTAGE', 'FIXED'])
  rule_type?: 'PERCENTAGE' | 'FIXED';

  @ApiPropertyOptional({
    example: 20,
    description: 'Override del valor de la regla. Requerido si se envía rule_type.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  rule_value?: number;
}
