import Decimal from 'decimal.js';

/**
 * Utilidades para operaciones monetarias con precisión
 * Evita errores de redondeo en cálculos financieros
 */

export class DecimalUtil {
  /**
   * Convierte un número o string a Decimal
   */
  static fromNumber(value: number | string | Decimal): Decimal {
    return new Decimal(value);
  }

  /**
   * Suma dos valores monetarios
   */
  static add(a: number | string | Decimal, b: number | string | Decimal): Decimal {
    return new Decimal(a).plus(new Decimal(b));
  }

  /**
   * Resta dos valores monetarios
   */
  static subtract(a: number | string | Decimal, b: number | string | Decimal): Decimal {
    return new Decimal(a).minus(new Decimal(b));
  }

  /**
   * Multiplica dos valores monetarios
   */
  static multiply(a: number | string | Decimal, b: number | string | Decimal): Decimal {
    return new Decimal(a).times(new Decimal(b));
  }

  /**
   * Divide dos valores monetarios
   */
  static divide(a: number | string | Decimal, b: number | string | Decimal): Decimal {
    return new Decimal(a).dividedBy(new Decimal(b));
  }

  /**
   * Calcula el porcentaje de un valor
   * Ejemplo: percentage(100, 10) = 10
   */
  static percentage(value: number | string | Decimal, percent: number | string | Decimal): Decimal {
    return new Decimal(value).times(new Decimal(percent)).dividedBy(100);
  }

  /**
   * Suma un array de valores monetarios
   */
  static sum(values: (number | string | Decimal)[]): Decimal {
    return values.reduce((acc: Decimal, val) => acc.plus(new Decimal(val)), new Decimal(0));
  }

  /**
   * Convierte a número con 2 decimales (para respuestas API)
   */
  static toNumber(value: number | string | Decimal, decimalPlaces: number = 2): number {
    return Number(new Decimal(value).toFixed(decimalPlaces));
  }

  /**
   * Convierte a string con formato de moneda
   */
  static toFixed(value: number | string | Decimal, decimalPlaces: number = 2): string {
    return new Decimal(value).toFixed(decimalPlaces);
  }

  /**
   * Compara dos valores monetarios
   * Retorna: -1 si a < b, 0 si a === b, 1 si a > b
   */
  static compare(a: number | string | Decimal, b: number | string | Decimal): number {
    return new Decimal(a).comparedTo(new Decimal(b));
  }

  /**
   * Verifica si dos valores son iguales
   */
  static equals(a: number | string | Decimal, b: number | string | Decimal): boolean {
    return new Decimal(a).equals(new Decimal(b));
  }

  /**
   * Obtiene el máximo entre dos valores
   */
  static max(a: number | string | Decimal, b: number | string | Decimal): Decimal {
    return Decimal.max(new Decimal(a), new Decimal(b));
  }

  /**
   * Obtiene el mínimo entre dos valores
   */
  static min(a: number | string | Decimal, b: number | string | Decimal): Decimal {
    return Decimal.min(new Decimal(a), new Decimal(b));
  }
}
