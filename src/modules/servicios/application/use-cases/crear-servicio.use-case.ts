import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { validarPrecio } from '../../domain/rules/validar-precio.rule';
import { CrearServicioDto } from '../dto/crear-servicio.dto';

@Injectable()
export class CrearServicioUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: CrearServicioDto, company_id: string, user_id: string) {
    let customer_id = dto.customer_id?.trim() || undefined;

    if (customer_id) {
      // Validate existing customer belongs to this company
      const customer = await this.prisma.customer.findFirst({ where: { id: customer_id, company_id } });
      if (!customer) throw new NotFoundException('Cliente no encontrado en esta empresa');
    } else {
      // Auto-create customer from service data
      if (!dto.customer_name || !dto.customer_address) {
        throw new BadRequestException('Debes proveer customer_id o los campos customer_name y customer_address');
      }
      const newCustomer = await this.prisma.customer.create({
        data: {
          company_id,
          name: dto.customer_name,
          address: dto.customer_address,
          phone: dto.customer_phone,
          email: dto.customer_email,
        },
      });
      customer_id = newCustomer.id;
    }

    const total_price = Number(dto.delivery_price) + Number(dto.product_price);
    validarPrecio({ delivery_price: dto.delivery_price, product_price: dto.product_price, total_price });

    const { customer_name, customer_address, customer_phone, customer_email, ...serviceData } = dto;

    const [servicio] = await this.prisma.$transaction(async (tx) => {
      const created = await tx.service.create({
        data: { ...serviceData, customer_id, company_id, total_price, status: 'PENDING' },
      });
      await tx.serviceStatusHistory.create({
        data: { company_id, service_id: created.id, previous_status: null, new_status: 'PENDING', user_id },
      });
      return [created];
    });

    return servicio;
  }
}
