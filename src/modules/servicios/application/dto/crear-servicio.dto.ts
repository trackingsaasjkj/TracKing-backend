import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CrearServicioDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001', description: 'UUID del cliente' })
  @IsUUID()
  customer_id!: string;

  @ApiProperty({ example: 'CASH', description: 'Método de pago (CASH, CARD, TRANSFER)' })
  @IsString()
  @IsNotEmpty()
  payment_method!: string;

  @ApiProperty({ example: 'Calle 10 # 5-20, Bogotá' })
  @IsString()
  @IsNotEmpty()
  origin_address!: string;

  @ApiPropertyOptional({ example: 'Apto 301' })
  @IsOptional()
  @IsString()
  origin_apartment_office?: string;

  @ApiProperty({ example: '3001234567' })
  @IsString()
  @IsNotEmpty()
  origin_contact_phone!: string;

  @ApiProperty({ example: 'Carrera 15 # 80-10, Bogotá' })
  @IsString()
  @IsNotEmpty()
  destination_address!: string;

  @ApiPropertyOptional({ example: 'Oficina 202' })
  @IsOptional()
  @IsString()
  destination_apartment_office?: string;

  @ApiProperty({ example: '3109876543' })
  @IsString()
  @IsNotEmpty()
  destination_contact_number!: string;

  @ApiProperty({ example: 'Pedro Gómez' })
  @IsString()
  @IsNotEmpty()
  destination_name!: string;

  @ApiProperty({ example: 'Caja pequeña, frágil' })
  @IsString()
  @IsNotEmpty()
  package_details!: string;

  @ApiProperty({ example: 8000, minimum: 0, description: 'Precio del domicilio' })
  @IsNumber()
  @Min(0)
  delivery_price!: number;

  @ApiProperty({ example: 45000, minimum: 0, description: 'Precio del producto' })
  @IsNumber()
  @Min(0)
  product_price!: number;

  @ApiPropertyOptional({ example: 'Llamar antes de llegar' })
  @IsOptional()
  @IsString()
  notes_observations?: string;
}
