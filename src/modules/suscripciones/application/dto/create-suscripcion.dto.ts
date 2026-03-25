import { IsDateString, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSuscripcionDto {
  @ApiProperty({ example: 'uuid-empresa', description: 'UUID de la empresa a suscribir' })
  @IsUUID()
  company_id!: string;

  @ApiProperty({ example: 'uuid-plan', description: 'UUID del plan' })
  @IsUUID()
  plan_id!: string;

  @ApiProperty({ example: '2026-01-01', description: 'Fecha de inicio (YYYY-MM-DD)' })
  @IsDateString()
  start_date!: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'Fecha de vencimiento (YYYY-MM-DD). Default: start_date + 1 mes',
  })
  @IsOptional()
  @IsDateString()
  end_date?: string;
}
