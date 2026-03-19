import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMensajeroDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440003', description: 'UUID del usuario con rol COURIER' })
  @IsUUID()
  user_id: string;

  @ApiPropertyOptional({ example: '1234567890', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  document_id?: string;

  @ApiPropertyOptional({ example: '3201234567', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}
