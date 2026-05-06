import { IsNotEmpty, IsString, MaxLength, IsOptional } from 'class-validator';
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
}
