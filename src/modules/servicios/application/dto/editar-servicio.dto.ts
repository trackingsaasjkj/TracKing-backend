import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';

export class EditarServicioDto {
  @ApiPropertyOptional({ enum: PaymentMethod, example: PaymentMethod.CASH })
  @IsOptional()
  @IsEnum(PaymentMethod)
  payment_method?: PaymentMethod;

  @ApiPropertyOptional({ example: 'Calle 10 # 5-20, Bogotá' })
  @IsOptional()
  @IsString()
  origin_address?: string;

  @ApiPropertyOptional({ example: 'Apto 301' })
  @IsOptional()
  @IsString()
  origin_apartment_office?: string;

  @ApiPropertyOptional({ example: '3001234567' })
  @IsOptional()
  @IsString()
  origin_contact_phone?: string;

  @ApiPropertyOptional({ example: 'Carrera 15 # 80-10, Bogotá' })
  @IsOptional()
  @IsString()
  destination_address?: string;

  @ApiPropertyOptional({ example: 'Oficina 202' })
  @IsOptional()
  @IsString()
  destination_apartment_office?: string;

  @ApiPropertyOptional({ example: '3109876543' })
  @IsOptional()
  @IsString()
  destination_contact_number?: string;

  @ApiPropertyOptional({ example: 'Pedro Gómez' })
  @IsOptional()
  @IsString()
  destination_name?: string;

  @ApiPropertyOptional({ example: 'Caja pequeña, frágil' })
  @IsOptional()
  @IsString()
  package_details?: string;

  @ApiPropertyOptional({ example: 8000, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  delivery_price?: number;

  @ApiPropertyOptional({ example: 45000, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  product_price?: number;

  @ApiPropertyOptional({ example: 'Llamar antes de llegar' })
  @IsOptional()
  @IsString()
  notes_observations?: string;

  @ApiPropertyOptional({ example: 4.710989 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  origin_lat?: number;

  @ApiPropertyOptional({ example: -74.072092 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  origin_lng?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  origin_verified?: boolean;

  @ApiPropertyOptional({ example: 4.710989 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  destination_lat?: number;

  @ApiPropertyOptional({ example: -74.072092 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  destination_lng?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  destination_verified?: boolean;
}
