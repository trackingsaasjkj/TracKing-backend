import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, UserRole, CourierStatus, ServiceStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AppException } from '../../../core/errors/app.exception';
import { Role } from '../../../core/constants/roles.enum';
import { AuditLogEntry } from '../domain/audit-log.service';
import { AuditLogFilterDto } from '../application/dto/audit-log-filter.dto';

@Injectable()
export class SuperAdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Tenants ────────────────────────────────────────────────────────────────

  async findAllTenants(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.company.findMany({
        skip,
        take: limit,
        include: {
          _count: { select: { users: true, services: true, couriers: true } },
        },
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.company.count(),
    ]);
    return { data, total, page, limit };
  }

  async findTenantById(id: string) {
    return this.prisma.company.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true, services: true, couriers: true } },
      },
    });
  }

  async createTenant(name: string) {
    try {
      return await this.prisma.company.create({ data: { name } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') throw new AppException('Ya existe un tenant con ese nombre', HttpStatus.CONFLICT);
      }
      throw error;
    }
  }

  async updateTenantStatus(id: string, status: boolean) {
    return this.prisma.company.update({ where: { id }, data: { status } });
  }

  async deleteTenant(id: string) {
    try {
      return await this.prisma.company.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') throw new AppException('Tenant no encontrado', HttpStatus.NOT_FOUND);
      }
      throw error;
    }
  }

  async getTenantDetail(id: string) {
    return this.prisma.company.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true, services: true, couriers: true } },
      },
    });
  }

  // ─── Usuarios ───────────────────────────────────────────────────────────────

  async findUsersByTenant(
    tenantId: string,
    filters: { role?: string; status?: string },
    page: number,
    limit: number,
  ) {
    const skip = (page - 1) * limit;
    const where: Prisma.UserWhereInput = { company_id: tenantId };
    if (filters.role) where.role = filters.role as Prisma.EnumUserRoleFilter;
    if (filters.status) where.status = filters.status as Prisma.EnumUserStatusFilter;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ where, skip, take: limit, orderBy: { created_at: 'desc' } }),
      this.prisma.user.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findUserById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppException('Usuario no encontrado', HttpStatus.NOT_FOUND);
    return user;
  }

  async updateUserStatus(id: string, status: UserStatus) {
    return this.prisma.user.update({ where: { id }, data: { status } });
  }

  async updateUserRole(id: string, role: Role) {
    return this.prisma.user.update({ where: { id }, data: { role: role as unknown as Prisma.EnumUserRoleFieldUpdateOperationsInput } });
  }

  async deleteUser(id: string) {
    try {
      return await this.prisma.user.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') throw new AppException('Usuario no encontrado', HttpStatus.NOT_FOUND);
      }
      throw error;
    }
  }

  // ─── Config ─────────────────────────────────────────────────────────────────

  async findAllConfig() {
    return this.prisma.globalConfig.findMany();
  }

  async findConfigByKey(key: string) {
    return this.prisma.globalConfig.findUnique({ where: { key } });
  }

  async createConfig(data: { key: string; value: string; description?: string }) {
    try {
      return await this.prisma.globalConfig.create({ data });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') throw new AppException('Ya existe una configuración con esa clave', HttpStatus.CONFLICT);
      }
      throw error;
    }
  }

  async updateConfig(key: string, value: string) {
    return this.prisma.globalConfig.update({ where: { key }, data: { value } });
  }

  // ─── Métricas ────────────────────────────────────────────────────────────────

  async getDashboardMetrics() {
    const [activeTenants] = await this.prisma.$transaction([
      this.prisma.company.count({ where: { status: true } }),
    ]);

    const [adminCount, auxCount, courierCount, superAdminCount] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { role: UserRole.ADMIN } }),
      this.prisma.user.count({ where: { role: UserRole.AUX } }),
      this.prisma.user.count({ where: { role: UserRole.COURIER } }),
      this.prisma.user.count({ where: { role: UserRole.SUPER_ADMIN } }),
    ]);

    const [pendingServices, assignedServices, deliveredServices, cancelledServices] = await this.prisma.$transaction([
      this.prisma.service.count({ where: { status: ServiceStatus.PENDING } }),
      this.prisma.service.count({ where: { status: ServiceStatus.ASSIGNED } }),
      this.prisma.service.count({ where: { status: ServiceStatus.DELIVERED } }),
      this.prisma.service.count({ where: { status: ServiceStatus.CANCELLED } }),
    ]);

    const [availableCouriers, unavailableCouriers, inServiceCouriers] = await this.prisma.$transaction([
      this.prisma.courier.count({ where: { operational_status: CourierStatus.AVAILABLE } }),
      this.prisma.courier.count({ where: { operational_status: CourierStatus.UNAVAILABLE } }),
      this.prisma.courier.count({ where: { operational_status: CourierStatus.IN_SERVICE } }),
    ]);

    return {
      activeTenants,
      usersByRole: { SUPER_ADMIN: superAdminCount, ADMIN: adminCount, AUX: auxCount, COURIER: courierCount },
      servicesByStatus: { PENDING: pendingServices, ASSIGNED: assignedServices, DELIVERED: deliveredServices, CANCELLED: cancelledServices },
      couriersByStatus: { AVAILABLE: availableCouriers, UNAVAILABLE: unavailableCouriers, IN_SERVICE: inServiceCouriers },
    };
  }

  async getTenantMetrics(tenantId: string, from: Date, to: Date) {
    const where = { company_id: tenantId, created_at: { gte: from, lte: to } };

    const [pending, assigned, delivered, cancelled, activeCouriers, settlements] = await this.prisma.$transaction([
      this.prisma.service.count({ where: { ...where, status: ServiceStatus.PENDING } }),
      this.prisma.service.count({ where: { ...where, status: ServiceStatus.ASSIGNED } }),
      this.prisma.service.count({ where: { ...where, status: ServiceStatus.DELIVERED } }),
      this.prisma.service.count({ where: { ...where, status: ServiceStatus.CANCELLED } }),
      this.prisma.courier.count({ where: { company_id: tenantId, operational_status: { not: CourierStatus.UNAVAILABLE } } }),
      this.prisma.courierSettlement.aggregate({
        where: { company_id: tenantId, generation_date: { gte: from, lte: to } },
        _sum: { company_commission: true },
      }),
    ]);

    return {
      servicesByStatus: { PENDING: pending, ASSIGNED: assigned, DELIVERED: delivered, CANCELLED: cancelled },
      activeCouriers,
      totalSettled: settlements._sum?.company_commission ?? 0,
    };
  }

  async getTenantsByVolume(from: Date, to: Date) {
    return this.prisma.service.groupBy({
      by: ['company_id'],
      where: { created_at: { gte: from, lte: to } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });
  }

  // ─── Audit ───────────────────────────────────────────────────────────────────

  async createAuditLog(data: AuditLogEntry) {
    return this.prisma.auditLog.create({
      data: {
        ...data,
        payload: data.payload as Prisma.InputJsonValue,
      },
    });
  }

  async findAuditLogs(filters: AuditLogFilterDto, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const where: Prisma.AuditLogWhereInput = {};

    if (filters.super_admin_id) where.super_admin_id = filters.super_admin_id;
    if (filters.entity_type) where.entity_type = filters.entity_type;
    if (filters.action) where.action = filters.action;
    if (filters.from || filters.to) {
      where.created_at = {};
      if (filters.from) where.created_at.gte = new Date(filters.from);
      if (filters.to) where.created_at.lte = new Date(filters.to);
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({ where, skip, take: limit, orderBy: { created_at: 'desc' } }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data, total, page, limit };
  }
}
