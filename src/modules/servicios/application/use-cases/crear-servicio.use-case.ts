import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { ServicioRepository } from '../../infrastructure/repositories/servicio.repository';
import { HistorialRepository } from '../../infrastructure/repositories/historial.repository';
import { validarPrecio } from '../../domain/rules/validar-precio.rule';
import { CrearServicioDto } from '../dto/crear-servicio.dto';

@Injectable()
export class CrearServicioUseCase {
  constructor(
    private readonly servicioRepo: ServicioRepository,
    private readonly historialRepo: HistorialRepository,
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

    const servicio = await this.servicioRepo.create({ ...dto, company_id, total_price });

    // Register initial status in history
    await this.historialRepo.create({
      company_id,
      service_id: servicio.id,
      previous_status: null,
      new_status: 'PENDING',
      user_id,
    });

    return servicio;
  }
}
