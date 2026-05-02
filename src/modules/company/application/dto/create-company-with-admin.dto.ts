import { Type } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength, ValidateNested, IsOptional, IsMobilePhone } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class CompanyDataDto {
  @ApiProperty({ example: 'Mensajería Rápida S.A.S', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({ example: '123456789', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nit?: string;

  @ApiPropertyOptional({ example: 'contacto@empresa.com' })
  @IsOptional()
  @IsEmail()
  email_corporativo?: string;

  @ApiPropertyOptional({ example: '+573001234567', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefono?: string;

  @ApiPropertyOptional({ example: 'Cra 45 #10-23, Bucaramanga' })
  @IsOptional()
  @IsString()
  direccion?: string;
}

class AdminDataDto {
  @ApiProperty({ example: 'Juan Pérez', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'admin@empresa.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'Password123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({ example: '+573001234567', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}

export class CreateCompanyWithAdminDto {
  @ApiProperty({ type: CompanyDataDto })
  @ValidateNested()
  @Type(() => CompanyDataDto)
  company!: CompanyDataDto;

  @ApiProperty({ type: AdminDataDto })
  @ValidateNested()
  @Type(() => AdminDataDto)
  admin!: AdminDataDto;
}
