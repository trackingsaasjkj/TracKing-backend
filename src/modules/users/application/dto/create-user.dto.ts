import { IsArray, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '../../../../core/constants/roles.enum';
import { Permission } from '../../../../core/constants/permissions.enum';

export class CreateUserDto {
  @ApiProperty({ example: 'María López' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'maria@empresa.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ enum: Role, example: Role.AUX })
  @IsEnum(Role)
  role!: Role;

  @ApiPropertyOptional({ enum: Permission, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(Permission, { each: true })
  permissions?: Permission[];
}
