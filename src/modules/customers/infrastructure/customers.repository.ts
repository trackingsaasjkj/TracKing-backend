import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PaginatedResponse } from '../../../core/types/paginated-response.type';

export interface CustomerTableRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string;
  status: boolean;
  is_favorite: boolean;
  created_at: Date;
}

@Injectable()
export class CustomersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(company_id: string) {
    return this.prisma.customer.findMany({
      where: { company_id, status: true },
      orderBy: { name: 'asc' },
    });
  }

  async findAllPaginated(
    company_id: string,
    pagination: { page: number; limit: number },
  ): Promise<PaginatedResponse<CustomerTableRow>> {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const select = {
      id: true,
      name: true,
      phone: true,
      email: true,
      address: true,
      status: true,
      is_favorite: true,
      created_at: true,
    };

    const where = { company_id, status: true };

    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        select,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  findById(id: string, company_id: string) {
    return this.prisma.customer.findFirst({ where: { id, company_id } });
  }

  findByName(name: string, company_id: string) {
    return this.prisma.customer.findFirst({
      where: {
        company_id,
        status: true,
        name: { equals: name, mode: 'insensitive' },
      },
    });
  }

  findByPhone(phone: string, company_id: string) {
    // Normalizar teléfono: remover todo excepto dígitos
    const normalized = phone.replace(/\D/g, '');

    return this.prisma.customer.findFirst({
      where: {
        company_id,
        status: true,
        phone: { contains: normalized },
      },
    });
  }

  create(data: { company_id: string; name: string; address: string; phone?: string; email?: string }) {
    return this.prisma.customer.create({ data });
  }

  update(id: string, company_id: string, data: { name?: string; address?: string; phone?: string; email?: string }) {
    return this.prisma.customer.updateMany({ where: { id, company_id }, data });
  }

  deactivate(id: string, company_id: string) {
    return this.prisma.customer.updateMany({ where: { id, company_id }, data: { status: false } });
  }

  toggleFavorite(id: string, company_id: string, is_favorite: boolean) {
    return this.prisma.customer.update({ where: { id }, data: { is_favorite } });
  }
}
