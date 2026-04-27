import { validarInicioJornada, validarFinJornada } from '../../../modules/mensajeros/domain/rules/validar-jornada.rule';
import { AppException } from '../../../core/errors/app.exception';

describe('validarInicioJornada', () => {
  it('allows UNAVAILABLE → AVAILABLE', () => {
    expect(() => validarInicioJornada('UNAVAILABLE')).not.toThrow();
  });

  it('throws when already AVAILABLE', () => {
    expect(() => validarInicioJornada('AVAILABLE')).toThrow(AppException);
  });

  it('allows IN_SERVICE (pedidos activos de sesión anterior) → no lanza error', () => {
    expect(() => validarInicioJornada('IN_SERVICE')).not.toThrow();
  });
});

describe('validarFinJornada', () => {
  it('allows AVAILABLE → UNAVAILABLE with no active services', () => {
    expect(() => validarFinJornada('AVAILABLE', 0)).not.toThrow();
  });

  it('throws when there are active services', () => {
    expect(() => validarFinJornada('AVAILABLE', 2)).toThrow(AppException);
  });

  it('throws when IN_SERVICE (cannot go directly to UNAVAILABLE)', () => {
    expect(() => validarFinJornada('IN_SERVICE', 0)).toThrow(AppException);
  });

  it('throws when already UNAVAILABLE', () => {
    expect(() => validarFinJornada('UNAVAILABLE', 0)).toThrow(AppException);
  });
});
