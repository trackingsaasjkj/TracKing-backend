import { Injectable, NotFoundException } from '@nestjs/common';
import { MensajeroRepository } from '../../infrastructure/mensajero.repository';
import { UpdateMensajeroDto } from '../dto/update-mensajero.dto';

@Injectable()
export class UpdateMensajeroUseCase {
  constructor(private readonly mensajeroRepo: MensajeroRepository) {}

  async execute(id: string, dto: UpdateMensajeroDto, company_id: string) {
    const mensajero = await this.mensajeroRepo.findById(id, company_id);
    if (!mensajero) throw new NotFoundException('Mensajero no encontrado');
    await this.mensajeroRepo.update(id, company_id, dto);
    return this.mensajeroRepo.findById(id, company_id);
  }
}
