import { notFound } from "next/navigation";
import { exigirCtx } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pode } from "@/lib/permissions";
import { Cabecalho, Alerta } from "@/components/ui";
import { FormFornecedor } from "./form";

export const metadata = { title: "Fornecedor" };

export default async function FornecedorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ salvo?: string }> }) {
  const { id } = await params;
  const { salvo } = await searchParams;
  const ctx = await exigirCtx();
  const novo = id === "novo";
  const fornecedor = novo
    ? null
    : await prisma.fornecedor.findFirst({ where: { id, tenantId: ctx.tenantId }, include: { materiasPrimas: true } });
  if (!novo && !fornecedor) notFound();
  const mps = await prisma.materiaPrima.findMany({ where: { tenantId: ctx.tenantId, ativo: true }, orderBy: { nomeComercial: "asc" }, select: { id: true, nomeComercial: true, categoria: true } });

  return (
    <div className="mx-auto max-w-4xl">
      <Cabecalho titulo={novo ? "Novo fornecedor" : fornecedor!.razaoSocial} subtitulo="POP 01 — Qualificação de Fornecedores e Matérias-Primas" />
      {salvo && <div className="mb-4"><Alerta tipo="sucesso">Fornecedor salvo. A alteração foi registrada na trilha de auditoria.</Alerta></div>}
      <FormFornecedor
        id={fornecedor?.id ?? null}
        inicial={fornecedor}
        vinculos={fornecedor?.materiasPrimas.map((m) => ({ id: m.materiaPrimaId, homologado: m.homologado })) ?? []}
        mps={mps}
        somenteLeitura={!pode(ctx.perfil, "cadastros:editar")}
      />
    </div>
  );
}
