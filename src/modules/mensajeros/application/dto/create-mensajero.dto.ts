import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMensajeroDto {
  @ApiProperty({ example: 'Carlos Gómez' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'carlos@empresa.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Password123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({ example: '1234567890', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  document_id?: string;

  @ApiPropertyOptional({ example: '3201234567', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}
