import { AppException } from '../../../../core/errors/app.exception';

export function validarPrecio(params: {
  delivery_price: number;
  product_price: number;
  total_price: number;
}): void {
  const expected = Number(params.delivery_price) + Number(params.product_price);
  if (Number(params.total_price) !== expected) {
    throw new AppException(
      `total_price debe ser delivery_price + product_price (esperado: ${expected})`,
    );
  }
}
