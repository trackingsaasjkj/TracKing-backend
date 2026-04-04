import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus } from '@prisma/client';

export class CambiarPagoDto {
  @ApiProperty({
    enum: PaymentStatus,
    example: PaymentStatus.UNPAID,
    description: 'PAID → payment_method cambia a CASH. UNPAID → payment_method cambia a CREDIT.',
  })
  @IsEnum(PaymentStatus)
  payment_status!: PaymentStatus;
}
