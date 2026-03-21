import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AsignarServicioDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002', description: 'UUID del mensajero' })
  @IsUUID()
  courier_id!: string;
}
