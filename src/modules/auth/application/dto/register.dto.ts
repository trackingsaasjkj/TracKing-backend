import { IsEmail, IsEnum, IsNotEmpty, IsString, IsUUID, MinLength, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '../../../../core/constants/roles.enum';

export class RegisterDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  company_id!: string;

  @ApiProperty({ example: 'Juan Pérez' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'juan@empresa.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ enum: Role, example: Role.AUX })
  @IsEnum(Role)
  role!: Role;

  @ApiPropertyOptional({ example: '+573001234567', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}
