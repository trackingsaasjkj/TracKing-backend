import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AutoAssignMode } from '@prisma/client';

export class UpdateAutoAssignDto {
  @ApiPropertyOptional({
    enum: AutoAssignMode,
    nullable: true,
    example: 'LEAST_SERVICES_TODAY',
    description: 'Modo de autoasignación. Enviar null para desactivar.',
  })
  @IsOptional()
  @IsEnum(AutoAssignMode)
  auto_assign_mode?: AutoAssignMode | null;
}
