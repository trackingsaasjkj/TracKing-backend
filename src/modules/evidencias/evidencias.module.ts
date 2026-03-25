import { Module } from '@nestjs/common';
import { EvidenciasController } from './evidencias.controller';
import { SubirEvidenciaUseCase } from './application/use-cases/subir-evidencia.use-case';
import { ConsultarEvidenciaUseCase } from './application/use-cases/consultar-evidencia.use-case';
import { EvidenciaRepository } from './infrastructure/evidencia.repository';
import { ServiciosModule } from '../servicios/servicios.module';

@Module({
  imports: [ServiciosModule], // re-uses exported ServicioRepository
  controllers: [EvidenciasController],
  providers: [
    SubirEvidenciaUseCase,
    ConsultarEvidenciaUseCase,
    EvidenciaRepository,
  ],
  exports: [EvidenciaRepository, SubirEvidenciaUseCase],
})
export class EvidenciasModule {}
