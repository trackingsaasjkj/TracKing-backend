import { validarPuedeEnviarUbicacion } from '../../../modules/tracking/domain/rules/validar-tracking.rule';
import { AppException } from '../../../core/errors/app.exception';

describe('validarPuedeEnviarUbicacion', () => {
  it('allows IN_SERVICE couriers', () => {
    expect(() => validarPuedeEnviarUbicacion('IN_SERVICE')).not.toThrow();
  });

  it('throws when AVAILABLE', () => {
    expect(() => validarPuedeEnviarUbicacion('AVAILABLE')).toThrow(AppException);
  });

  it('throws when UNAVAILABLE', () => {
    expect(() => validarPuedeEnviarUbicacion('UNAVAILABLE')).toThrow(AppException);
  });
});
