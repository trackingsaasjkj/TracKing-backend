import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ServicioEstado } from '../../domain/state-machine/servicio.machine';

const ALLOWED: ServicioEstado[] = ['ACCEPTED', 'IN_TRANSIT', 'DELIVERED'];

export class CambiarEstadoDto {
  @ApiProperty({
    enum: ALLOWED,
    example: 'ACCEPTED',
    description: 'Nuevo estado. ASSIGNED usa su propio endpoint /assign. CANCELLED usa /cancel.',
  })
  @IsEnum(ALLOWED, { message: `status debe ser uno de: ${ALLOWED.join(', ')}` })
  status!: ServicioEstado;
}
