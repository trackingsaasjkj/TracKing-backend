import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

export interface GlobalSearchResult {
  customers: CustomerResult[];
  couriers: CourierResult[];
  users: UserResult[];
  services: ServiceResult[];
}

export interface CustomerResult {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address: string;
  status?: boolean;
}

export interface CourierResult {
  id: string;
  name: string;
  phone?: string | null;
  document_id?: string | null;
  operational_status: string;
}

export interface UserResult {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

export interface ServiceResult {
  id: string;
  tracking_number?: string | null;
  destination_name: string;
  destination_address: string;
  origin_address: string;
  status: string;
  customer_name?: string | null;
  courier_name?: string | null;
  delivery_price: number;
}

@Injectable()
export class GlobalSearchUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(q: string, company_id: string): Promise<GlobalSearchResult> {
    const term = q.trim();
    const like = { contains: term, mode: 'insensitive' as const };

    const [customers, couriers, users, services] = await Promise.all([
      // Customers: search by name, phone, email
      this.prisma.customer.findMany({
        where: {
          company_id,
          status: true,
          OR: [{ name: like }, { phone: like }, { email: like }],
        },
        select: { id: true, name: true, phone: true, email: true, address: true, status: true },
        take: 5,
        orderBy: { name: 'asc' },
      }),

      // Couriers: search by user name, phone, document_id
      this.prisma.courier.findMany({
        where: {
          company_id,
          OR: [
            { user: { name: like } },
            { phone: like },
            { document_id: like },
          ],
        },
        select: {
          id: true,
          phone: true,
          document_id: true,
          operational_status: true,
          user: { select: { name: true } },
        },
        take: 5,
        orderBy: { user: { name: 'asc' } },
      }),

      // Users: search by name, email
      this.prisma.user.findMany({
        where: {
          company_id,
          OR: [{ name: like }, { email: like }],
        },
        select: { id: true, name: true, email: true, role: true, status: true },
        take: 5,
        orderBy: { name: 'asc' },
      }),

      // Services: search by tracking_number, destination_name, destination_address, origin_address, package_details
      this.prisma.service.findMany({
        where: {
          company_id,
          OR: [
            { tracking_number: like },
            { destination_name: like },
            { destination_address: like },
            { origin_address: like },
            { package_details: like },
            { customer: { name: like } },
          ],
        },
        select: {
          id: true,
          tracking_number: true,
          destination_name: true,
          destination_address: true,
          origin_address: true,
          status: true,
          delivery_price: true,
          customer: { select: { name: true } },
          courier: { select: { user: { select: { name: true } } } },
        },
        take: 5,
        orderBy: { created_at: 'desc' },
      }),
    ]);

    return {
      customers: customers.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        status: c.status,
      })),
      couriers: couriers.map((c) => ({
        id: c.id,
        name: c.user?.name ?? '',
        phone: c.phone,
        document_id: c.document_id,
        operational_status: c.operational_status,
      })),
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
      })),
      services: services.map((s) => ({
        id: s.id,
        tracking_number: s.tracking_number,
        destination_name: s.destination_name,
        destination_address: s.destination_address,
        origin_address: s.origin_address,
        status: s.status,
        delivery_price: Number(s.delivery_price),
        customer_name: s.customer?.name ?? null,
        courier_name: s.courier?.user?.name ?? null,
      })),
    };
  }
}
