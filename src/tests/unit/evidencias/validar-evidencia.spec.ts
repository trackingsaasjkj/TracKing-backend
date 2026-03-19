import { validarSubidaEvidencia } from '../../../modules/evidencias/domain/rules/validar-evidencia.rule';
import { AppException } from '../../../core/errors/app.exception';

describe('validarSubidaEvidencia', () => {
  it('allows upload when service is IN_TRANSIT', () => {
    expect(() => validarSubidaEvidencia('IN_TRANSIT')).not.toThrow();
  });

  it('throws when service is PENDING', () => {
    expect(() => validarSubidaEvidencia('PENDING')).toThrow(AppException);
  });

  it('throws when service is ASSIGNED', () => {
    expect(() => validarSubidaEvidencia('ASSIGNED')).toThrow(AppException);
  });

  it('throws when service is ACCEPTED', () => {
    expect(() => validarSubidaEvidencia('ACCEPTED')).toThrow(AppException);
  });

  it('throws when service is DELIVERED', () => {
    expect(() => validarSubidaEvidencia('DELIVERED')).toThrow(AppException);
  });

  it('throws when service is CANCELLED', () => {
    expect(() => validarSubidaEvidencia('CANCELLED')).toThrow(AppException);
  });
});
