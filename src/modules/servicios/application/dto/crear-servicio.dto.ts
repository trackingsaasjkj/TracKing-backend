import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';

export class CrearServicioDto {
  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'UUID del cliente existente. Si no se provee, se crea uno nuevo con los campos customer_*',
  })
  @IsOptional()
  @IsUUID()
  customer_id?: string;

  @ApiPropertyOptional({ example: 'Pedro Gómez', description: 'Nombre del cliente (requerido si no se provee customer_id)' })
  @IsOptional()
  @IsString()
  customer_name?: string;

  @ApiPropertyOptional({ example: 'Calle 10 #20-30', description: 'Dirección del cliente (requerido si no se provee customer_id)' })
  @IsOptional()
  @IsString()
  customer_address?: string;

  @ApiPropertyOptional({ example: '3001234567' })
  @IsOptional()
  @IsString()
  customer_phone?: string;

  @ApiPropertyOptional({ example: 'pedro@correo.com' })
  @IsOptional()
  @IsString()
  customer_email?: string;

  @ApiProperty({
    enum: PaymentMethod,
    example: PaymentMethod.CASH,
    description: 'Método de pago. CASH/TRANSFER → payment_status: PAID. CREDIT → payment_status: UNPAID.',
  })
  @IsEnum(PaymentMethod)
  payment_method!: PaymentMethod;

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

  // ─── Geocoding fields (optional) ─────────────────────────────────────────

  @ApiPropertyOptional({ example: 4.710989, description: 'Latitud del punto de recogida' })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  origin_lat?: number;

  @ApiPropertyOptional({ example: -74.072092, description: 'Longitud del punto de recogida' })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  origin_lng?: number;

  @ApiPropertyOptional({ example: false, description: 'Indica si las coordenadas de recogida fueron verificadas visualmente' })
  @IsOptional()
  @IsBoolean()
  origin_verified?: boolean;

  @ApiPropertyOptional({ example: 4.710989, description: 'Latitud del punto de entrega' })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  destination_lat?: number;

  @ApiPropertyOptional({ example: -74.072092, description: 'Longitud del punto de entrega' })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  destination_lng?: number;

  @ApiPropertyOptional({ example: false, description: 'Indica si las coordenadas de entrega fueron verificadas visualmente' })
  @IsOptional()
  @IsBoolean()
  destination_verified?: boolean;
}
