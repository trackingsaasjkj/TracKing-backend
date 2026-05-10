import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { CacheService } from '../../../../infrastructure/cache/cache.service';
import { validarPrecio } from '../../domain/rules/validar-precio.rule';
import { calcularPaymentStatusInicial } from '../../domain/rules/validar-pago.rule';
import { CrearServicioDto } from '../dto/crear-servicio.dto';
import { DashboardUpdatesGateway } from '../../dashboard-updates.gateway';
import { AutoAsignarServicioUseCase } from './auto-asignar-servicio.use-case';
import { nextTrackingNumber } from '../../../../core/utils/tracking-number.util';

@Injectable()
export class CrearServicioUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    @Optional() private readonly dashboardGateway: DashboardUpdatesGateway,
    @Optional() private readonly autoAsignar: AutoAsignarServicioUseCase,
  ) {}

  async execute(dto: CrearServicioDto, company_id: string, user_id: string) {
    let customer_id = dto.customer_id?.trim() || undefined;

    if (customer_id) {
      const customer = await this.prisma.customer.findFirst({ where: { id: customer_id, company_id } });
      if (!customer) throw new NotFoundException('Cliente no encontrado en esta empresa');
    } else {
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

    const payment_status = calcularPaymentStatusInicial(dto.payment_method);

    const { customer_name, customer_address, customer_phone, customer_email, auto_assign, ...serviceData } = dto;

    const [servicio] = await this.prisma.$transaction(async (tx) => {
      // Get the last tracking number to generate the next one
      const lastService = await tx.service.findFirst({
        where: { tracking_number: { not: null } },
        orderBy: { created_at: 'desc' },
        select: { tracking_number: true },
      });
      const tracking_number = nextTrackingNumber(lastService?.tracking_number);

      const created = await tx.service.create({
        data: { ...serviceData, customer_id, company_id, total_price, status: 'PENDING', payment_status, tracking_number },
      });
      await tx.serviceStatusHistory.create({
        data: { company_id, service_id: created.id, previous_status: null, new_status: 'PENDING', user_id },
      });
      return [created];
    });

    this.cache.deleteByPrefix(`bff:dashboard:${company_id}`);
    this.cache.deleteByPrefix(`bff:active-orders:${company_id}`);

    // Notify admin/aux in real-time
    if (this.dashboardGateway) {
      this.dashboardGateway.emitServiceUpdated(company_id, servicio as Record<string, unknown>);
      this.dashboardGateway.emitDashboardRefresh(company_id);
    }

    // Auto-assign if requested and the use case is available
    if (dto.auto_assign && this.autoAsignar) {
      await this.autoAsignar.tryAutoAssign(servicio.id, company_id, user_id);
    }

    return servicio;
  }
}
