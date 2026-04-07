import { Injectable } from '@nestjs/common';
import { ConsultarMensajerosUseCase } from '../../../mensajeros/application/use-cases/consultar-mensajeros.use-case';
import { GestionarReglasUseCase } from '../../../liquidaciones/application/use-cases/gestionar-reglas.use-case';
import { LiquidacionRepository } from '../../../liquidaciones/infrastructure/liquidacion.repository';

@Injectable()
export class BffLiquidacionesUseCase {
  constructor(
    private readonly consultarMensajeros: ConsultarMensajerosUseCase,
    private readonly gestionarReglas: GestionarReglasUseCase,
    private readonly liquidacionRepo: LiquidacionRepository,
  ) {}

  async execute(company_id: string) {
    const [mensajeros, reglaActiva, pendientesHoy] = await Promise.all([
      this.consultarMensajeros.findAll(company_id),
      this.gestionarReglas.findActive(company_id),
      this.liquidacionRepo.countCouriersWithPendingToday(company_id),
    ]);

    return {
      mensajeros,
      regla_activa: reglaActiva,
      pendientes_hoy: pendientesHoy,
    };
  }
}
