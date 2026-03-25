import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePlanDto {
  @ApiProperty({ example: 'Pro' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'Plan para empresas medianas' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 20, description: 'Máximo de mensajeros activos' })
  @IsInt()
  @Min(1)
  max_couriers!: number;

  @ApiProperty({ example: 500, description: 'Máximo de servicios por mes (0 = ilimitado)' })
  @IsInt()
  @Min(0)
  max_services_per_month!: number;

  @ApiProperty({ example: 10, description: 'Máximo de usuarios en la empresa' })
  @IsInt()
  @Min(1)
  max_users!: number;

  @ApiProperty({ example: 150000, description: 'Precio mensual del plan' })
  @IsNumber()
  @Min(0)
  price!: number;
}
