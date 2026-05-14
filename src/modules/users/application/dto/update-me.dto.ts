import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateMeDto {
  @ApiPropertyOptional({ example: 'Juan Pérez' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ example: '+573001234567', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: 'claveActual123', minLength: 6, description: 'Contraseña actual — requerida si se quiere cambiar la contraseña.' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  currentPassword?: string;

  @ApiPropertyOptional({ example: 'nuevaClaveSegura1', minLength: 6, description: 'Nueva contraseña. Requiere enviar currentPassword.' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
