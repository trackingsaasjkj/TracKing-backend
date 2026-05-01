import { IsArray, IsEmail, IsEnum, IsOptional, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '../../../../core/constants/roles.enum';
import { UserStatus } from '@prisma/client';
import { Permission } from '../../../../core/constants/permissions.enum';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Carlos Ruiz' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'carlos@empresa.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+573001234567', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ example: 'newpassword123', minLength: 8 })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({ enum: Permission, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(Permission, { each: true })
  permissions?: Permission[];
}
