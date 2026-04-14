import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForwardGeocodingDto {
  @ApiProperty({ example: 'Calle 10 #20-30, Bogotá', description: 'Dirección a geocodificar' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address!: string;
}
