import { validarTransicion } from '../../../modules/servicios/domain/rules/validar-transicion.rule';
import { AppException } from '../../../core/errors/app.exception';

describe('validarTransicion', () => {
  it('allows valid transition', () => {
    expect(() => validarTransicion('PENDING', 'ASSIGNED')).not.toThrow();
  });

  it('throws on invalid transition', () => {
    expect(() => validarTransicion('PENDING', 'DELIVERED')).toThrow(AppException);
  });

  it('throws when transitioning from final state', () => {
    expect(() => validarTransicion('DELIVERED', 'CANCELLED')).toThrow(AppException);
  });
});
