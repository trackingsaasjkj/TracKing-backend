import { IsArray, IsUUID, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerarLiquidacionClienteDto {
  @ApiProperty({
    example: ['550e8400-e29b-41d4-a716-446655440010'],
    description: 'UUIDs de los servicios a liquidar',
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  service_ids!: string[];
}
