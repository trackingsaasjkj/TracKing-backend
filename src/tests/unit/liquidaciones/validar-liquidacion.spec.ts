import {
  validarReglaActiva,
  validarRangoFechas,
  validarResultadoLiquidacion,
} from '../../../modules/liquidaciones/domain/rules/validar-liquidacion.rule';
import { AppException } from '../../../core/errors/app.exception';

describe('validarReglaActiva', () => {
  it('passes when rule exists', () => {
    expect(() => validarReglaActiva({ type: 'PERCENTAGE', value: 15 })).not.toThrow();
  });

  it('throws when rule is null', () => {
    expect(() => validarReglaActiva(null)).toThrow(AppException);
  });
});

describe('validarRangoFechas', () => {
  it('passes when start < end', () => {
    expect(() => validarRangoFechas(new Date('2025-01-01'), new Date('2025-01-31'))).not.toThrow();
  });

  it('throws when start === end', () => {
    const d = new Date('2025-01-01');
    expect(() => validarRangoFechas(d, d)).toThrow(AppException);
  });

  it('throws when start > end', () => {
    expect(() => validarRangoFechas(new Date('2025-02-01'), new Date('2025-01-01'))).toThrow(AppException);
  });
});

describe('validarResultadoLiquidacion', () => {
  it('passes with valid totals', () => {
    expect(() => validarResultadoLiquidacion(3, 9000)).not.toThrow();
  });

  it('throws when totalServices is 0', () => {
    expect(() => validarResultadoLiquidacion(0, 0)).toThrow(AppException);
  });

  it('throws when totalEarned is 0', () => {
    expect(() => validarResultadoLiquidacion(3, 0)).toThrow(AppException);
  });

  it('throws when totalEarned is negative', () => {
    expect(() => validarResultadoLiquidacion(3, -100)).toThrow(AppException);
  });
});
