import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { validarPrecio } from '../../domain/rules/validar-precio.rule';
import { CrearServicioDto } from '../dto/crear-servicio.dto';

@Injectable()
export class CrearServicioUseCase {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(dto: CrearServicioDto, company_id: string, user_id: string) {
    // Validate customer belongs to same company
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customer_id, company_id },
    });
    if (!customer) throw new NotFoundException('Cliente no encontrado en esta empresa');

    const total_price = Number(dto.delivery_price) + Number(dto.product_price);
    validarPrecio({ delivery_price: dto.delivery_price, product_price: dto.product_price, total_price });

    const [servicio] = await this.prisma.$transaction(async (tx) => {
      const created = await tx.service.create({
        data: { ...dto, company_id, total_price, status: 'PENDING' },
      });
      await tx.serviceStatusHistory.create({
        data: {
          company_id,
          service_id: created.id,
          previous_status: null,
          new_status: 'PENDING',
          user_id,
        },
      });
      return [created];
    });

    return servicio;
  }
}
