export function validarPrecio({ delivery_price, product_price, total_price }) {
  const esperado = delivery_price + product_price;

  if (Number(total_price) !== Number(esperado)) {
    throw new Error("El total no coincide con la suma de los valores");
  }
}
