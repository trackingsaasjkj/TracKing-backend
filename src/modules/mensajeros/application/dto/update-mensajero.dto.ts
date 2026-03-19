import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateMensajeroDto {
  @ApiPropertyOptional({ example: '9876543210', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  document_id?: string;

  @ApiPropertyOptional({ example: '3009876543', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}
