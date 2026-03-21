import { IsNumber, IsOptional, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterLocationDto {
  @ApiProperty({ example: 4.710989, description: 'Latitud decimal (-90 a 90)' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({ example: -74.072092, description: 'Longitud decimal (-180 a 180)' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @ApiPropertyOptional({ example: 10.5, description: 'Precisión en metros' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracy?: number;
}
