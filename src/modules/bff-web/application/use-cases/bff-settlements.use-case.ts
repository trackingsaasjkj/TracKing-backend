import { Injectable } from '@nestjs/common';
import { ConsultarMensajerosUseCase } from '../../../mensajeros/application/use-cases/consultar-mensajeros.use-case';
import { ConsultarLiquidacionesUseCase } from '../../../liquidaciones/application/use-cases/consultar-liquidaciones.use-case';
import { GestionarReglasUseCase } from '../../../liquidaciones/application/use-cases/gestionar-reglas.use-case';

@Injectable()
export class BffSettlementsUseCase {
  constructor(
    private readonly consultarMensajeros: ConsultarMensajerosUseCase,
    private readonly consultarLiquidaciones: ConsultarLiquidacionesUseCase,
    private readonly gestionarReglas: GestionarReglasUseCase,
  ) {}

  async execute(company_id: string, courier_id?: string) {
    const [couriers, activeRule, earnings] = await Promise.all([
      this.consultarMensajeros.findActivos(company_id),
      this.gestionarReglas.findActive(company_id),
      this.consultarLiquidaciones.getEarnings(company_id, courier_id),
    ]);

    return {
      couriers,
      active_rule: activeRule,
      earnings,
    };
  }
}
