import { IsEnum, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRuleDto {
  @ApiProperty({ enum: ['PERCENTAGE', 'FIXED'], example: 'PERCENTAGE', description: 'PERCENTAGE aplica % sobre delivery_price. FIXED aplica monto fijo por servicio.' })
  @IsEnum(['PERCENTAGE', 'FIXED'])
  type!: 'PERCENTAGE' | 'FIXED';

  @ApiProperty({ example: 15, description: 'Para PERCENTAGE: porcentaje (ej: 15 = 15%). Para FIXED: monto en pesos.' })
  @IsNumber()
  @Min(0)
  value!: number;
}
