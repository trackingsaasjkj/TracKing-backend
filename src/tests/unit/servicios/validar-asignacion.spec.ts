import { validarAsignacion } from '../../../modules/servicios/domain/rules/validar-asignacion.rule';
import { AppException } from '../../../core/errors/app.exception';

describe('validarAsignacion', () => {
  const availableCourier = { operational_status: 'AVAILABLE' };
  const inServiceCourier = { operational_status: 'IN_SERVICE' };
  const unavailableCourier = { operational_status: 'UNAVAILABLE' };

  it('passes with AVAILABLE courier and PENDING service', () => {
    expect(() => validarAsignacion({ courier: availableCourier, estado: 'PENDING' })).not.toThrow();
  });

  it('passes with IN_SERVICE courier and PENDING service (multi-service support)', () => {
    expect(() => validarAsignacion({ courier: inServiceCourier, estado: 'PENDING' })).not.toThrow();
  });

  it('throws when courier is null', () => {
    expect(() => validarAsignacion({ courier: null, estado: 'PENDING' })).toThrow(AppException);
  });

  it('throws when courier is UNAVAILABLE (not in jornada)', () => {
    expect(() => validarAsignacion({ courier: unavailableCourier, estado: 'PENDING' })).toThrow(AppException);
  });

  it('throws when service is in an invalid state for assignment (e.g. DELIVERED)', () => {
    expect(() => validarAsignacion({ courier: availableCourier, estado: 'DELIVERED' })).toThrow(AppException);
  });

  it('passes when service is ASSIGNED or ACCEPTED (reassignment)', () => {
    expect(() => validarAsignacion({ courier: availableCourier, estado: 'ASSIGNED' })).not.toThrow();
    expect(() => validarAsignacion({ courier: availableCourier, estado: 'ACCEPTED' })).not.toThrow();
  });
});
