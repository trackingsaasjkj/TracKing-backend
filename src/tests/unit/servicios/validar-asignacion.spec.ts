import { validarAsignacion } from '../../../modules/servicios/domain/rules/validar-asignacion.rule';
import { AppException } from '../../../core/errors/app.exception';

describe('validarAsignacion', () => {
  const availableCourier = { operational_status: 'AVAILABLE' };
  const busyCourier = { operational_status: 'IN_SERVICE' };

  it('passes with available courier and PENDING service', () => {
    expect(() => validarAsignacion({ courier: availableCourier, estado: 'PENDING' })).not.toThrow();
  });

  it('throws when courier is null', () => {
    expect(() => validarAsignacion({ courier: null, estado: 'PENDING' })).toThrow(AppException);
  });

  it('throws when courier is not AVAILABLE', () => {
    expect(() => validarAsignacion({ courier: busyCourier, estado: 'PENDING' })).toThrow(AppException);
  });

  it('throws when service is not PENDING', () => {
    expect(() => validarAsignacion({ courier: availableCourier, estado: 'ASSIGNED' })).toThrow(AppException);
  });
});
