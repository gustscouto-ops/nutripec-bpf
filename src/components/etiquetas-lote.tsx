import Link from "next/link";
import { prisma } from "@/lib/db";

/** Atalho da ordem de produção para as etiquetas do lote (o produto define o rótulo). */
export async function EtiquetasLote({ ordemId, tenantId }: { ordemId: string; tenantId: string }) {
  const o = await prisma.producaoOrdem.findFirst({ where: { id: ordemId, tenantId }, select: { produtoId: true } });
  if (!o) return null;
  return (
    <Link href={`/produtos/${o.produtoId}/rotulo?ordem=${ordemId}`} className="btn-secundario">
      Etiquetas do lote
    </Link>
  );
}
