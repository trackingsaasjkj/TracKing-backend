import { Type } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class CompanyDataDto {
  @ApiProperty({ example: 'Mensajería Rápida S.A.S', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;
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
