import { IsNotEmpty, IsString, MaxLength, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SearchDto {
  @ApiProperty({ example: 'Calle 10 #20-30, Bogotá', description: 'Búsqueda de dirección o POI' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  query!: string;

  @ApiProperty({ example: 'Bogotá', description: 'Ciudad para filtrar resultados (opcional)', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  city?: string;

  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', description: 'Token de sesión para optimizar búsquedas (opcional)', required: false })
  @IsUUID()
  @IsOptional()
  sessionToken?: string;
}
