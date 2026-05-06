import { IsNumber, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReverseSearchDto {
  @ApiProperty({ example: -74.072092, description: 'Longitud' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @ApiProperty({ example: 4.710989, description: 'Latitud' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;
}
