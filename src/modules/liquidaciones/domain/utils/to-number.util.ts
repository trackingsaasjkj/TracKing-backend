import { Prisma } from '@prisma/client';

export function toNumber(decimal: Prisma.Decimal | number | null | undefined): number {
  if (decimal === null || decimal === undefined) return 0;
  return Number(decimal);
}
