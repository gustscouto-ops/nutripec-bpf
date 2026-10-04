import { notFound } from "next/navigation";
import { exigirCtx } from "@/lib/auth";
import { prisma, plain } from "@/lib/db";
import { pode } from "@/lib/permissions";
import { Cabecalho } from "@/components/ui";
import { FormMateriaPrima } from "./form";

export const metadata = { title: "Matéria-prima" };

export default async function MateriaPrimaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await exigirCtx();
  const novo = id === "novo";
  const mp = novo ? null : await prisma.materiaPrima.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!novo && !mp) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <Cabecalho titulo={novo ? "Nova matéria-prima" : mp!.nomeComercial} />
      <FormMateriaPrima id={mp?.id ?? null} inicial={mp ? (plain(mp) as unknown as Record<string, string | number | boolean | null>) : null} somenteLeitura={!pode(ctx.perfil, "cadastros:editar")} />
    </div>
  );
}
