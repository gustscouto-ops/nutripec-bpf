import { PrismaClient, Prisma } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type Tx = Prisma.TransactionClient;

/** Converte Decimal/Date/BigInt em valores serializáveis (para JSON, auditoria e componentes cliente). */
export function plain<T>(value: T): T {
  // toJSON() do Decimal roda antes do replacer, por isso olhamos o valor original em this[k].
  return JSON.parse(
    JSON.stringify(value, function (this: Record<string, unknown>, k, v) {
      const original = this[k];
      if (typeof original === "bigint") return original.toString();
      if (Prisma.Decimal.isDecimal(original)) return Number(original);
      return v;
    }),
  );
}

export function num(v: Prisma.Decimal | number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return Number(v);
}
