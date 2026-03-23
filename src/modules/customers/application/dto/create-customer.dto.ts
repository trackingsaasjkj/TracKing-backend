import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCustomerDto {
  @ApiProperty({ example: 'Pedro Gómez', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiProperty({ example: 'Calle 10 #20-30, Bogotá' })
  @IsString()
  @IsNotEmpty()
  address!: string;

  @ApiPropertyOptional({ example: '3001234567', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: 'pedro@correo.com' })
  @IsOptional()
  @IsEmail()
  email?: string;
}
