import { Injectable, NotFoundException } from '@nestjs/common';
import { CustomersRepository } from '../../infrastructure/customers.repository';
import { CreateCustomerDto } from '../dto/create-customer.dto';
import { UpdateCustomerDto } from '../dto/update-customer.dto';

@Injectable()
export class CustomersUseCases {
  constructor(private readonly repo: CustomersRepository) {}

  findAll(company_id: string, pagination?: { page: number; limit: number }) {
    if (pagination) {
      return this.repo.findAllPaginated(company_id, pagination);
    }
    return this.repo.findAll(company_id);
  }

  async findById(id: string, company_id: string) {
    const customer = await this.repo.findById(id, company_id);
    if (!customer) throw new NotFoundException('Cliente no encontrado');
    return customer;
  }

  create(dto: CreateCustomerDto, company_id: string) {
    return this.repo.create({ ...dto, company_id });
  }

  async update(id: string, dto: UpdateCustomerDto, company_id: string) {
    await this.findById(id, company_id);
    await this.repo.update(id, company_id, dto);
    return this.repo.findById(id, company_id);
  }

  async deactivate(id: string, company_id: string) {
    await this.findById(id, company_id);
    await this.repo.deactivate(id, company_id);
  }

  async toggleFavorite(id: string, company_id: string) {
    const customer = await this.findById(id, company_id);
    await this.repo.toggleFavorite(id, company_id, !customer!.is_favorite);
    return this.repo.findById(id, company_id);
  }
}
