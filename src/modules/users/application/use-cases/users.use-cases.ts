import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { UsersRepository } from '../../infrastructure/users.repository';
import { TokenService } from '../../../auth/domain/token.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { Role } from '../../../../core/constants/roles.enum';

@Injectable()
export class UsersUseCases {
  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly tokenService: TokenService,
  ) {}

  async findAll(company_id: string) {
    return this.usersRepo.findAll(company_id);
  }

  async findById(id: string, company_id: string) {
    const user = await this.usersRepo.findById(id, company_id);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async findByEmail(email: string, company_id: string) {
    const user = await this.usersRepo.findByEmail(email, company_id);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async create(dto: CreateUserDto, company_id: string) {
    const existing = await this.usersRepo.findByEmail(dto.email, company_id);
    if (existing) throw new ConflictException('Email ya registrado en esta empresa');

    const password_hash = await this.tokenService.hashPassword(dto.password);
    const { password, permissions, ...rest } = dto;
    return this.usersRepo.create({
      ...rest,
      company_id,
      password_hash,
      permissions: dto.role === Role.AUX ? (permissions ?? []) : [],
    });
  }

  async update(id: string, dto: UpdateUserDto, company_id: string) {
    const user = await this.findById(id, company_id);
    const data: any = { ...dto };
    if (dto.password) {
      data.password_hash = await this.tokenService.hashPassword(dto.password);
      delete data.password;
    }

    const targetRole = dto.role ?? user.role;
    if (targetRole !== Role.AUX) {
      delete data.permissions;
    }

    return this.usersRepo.update(id, company_id, data);
  }

  async remove(id: string, company_id: string) {
    await this.findById(id, company_id);
    await this.usersRepo.delete(id, company_id);
  }
}
