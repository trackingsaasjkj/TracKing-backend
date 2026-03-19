import { validarPrecio } from '../../../modules/servicios/domain/rules/validar-precio.rule';
import { AppException } from '../../../core/errors/app.exception';

describe('validarPrecio', () => {
  it('passes when total equals delivery + product', () => {
    expect(() => validarPrecio({ delivery_price: 10, product_price: 20, total_price: 30 })).not.toThrow();
  });

  it('throws when total does not match', () => {
    expect(() => validarPrecio({ delivery_price: 10, product_price: 20, total_price: 25 })).toThrow(AppException);
  });

  it('handles decimal values correctly', () => {
    expect(() => validarPrecio({ delivery_price: 5.5, product_price: 4.5, total_price: 10 })).not.toThrow();
  });
});
