import { notFound } from "next/navigation";
import { exigirCtx } from "@/lib/auth";
import { prisma, plain } from "@/lib/db";
import { pode } from "@/lib/permissions";
import { Cabecalho, Selo } from "@/components/ui";
import { COR_FORMULA, ROTULO_FORMULA, dataHora } from "@/lib/formato";
import { EditorProduto, type ProdutoEditor } from "./editor";

export const metadata = { title: "Produto" };

export default async function ProdutoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await exigirCtx();
  const novo = id === "novo";
  const produto = novo
    ? null
    : await prisma.produto.findFirst({ where: { id, tenantId: ctx.tenantId }, include: { itens: { orderBy: { ordemDosagem: "asc" } } } });
  if (!novo && !produto) notFound();
  const mps = await prisma.materiaPrima.findMany({
    where: { tenantId: ctx.tenantId, ativo: true },
    orderBy: { nomeComercial: "asc" },
    select: { id: true, nomeComercial: true },
  });

  return (
    <div className="mx-auto max-w-5xl">
      <Cabecalho
        titulo={novo ? "Novo produto" : `${produto!.codigo} · ${produto!.nome}`}
        subtitulo={
          produto && (
            <span className="flex flex-wrap items-center gap-2">
              <Selo cor={COR_FORMULA[produto.statusFormula]}>{ROTULO_FORMULA[produto.statusFormula]}</Selo>
              <span>Versão {produto.versaoFormula}</span>
              {produto.dataAprovacaoRt && (
                <span>
                  · Assinada por {produto.aprovadoRtNome} em {dataHora(produto.dataAprovacaoRt)} ·{" "}
                  <span className="font-mono text-xs">hash {produto.hashFormula?.slice(0, 16)}…</span>
                </span>
              )}
            </span>
          )
        }
      />
      <EditorProduto
        id={produto?.id ?? null}
        inicial={produto ? (plain(produto) as unknown as ProdutoEditor) : null}
        mps={mps}
        podeEditar={pode(ctx.perfil, "cadastros:editar")}
        podeAprovar={pode(ctx.perfil, "formula:aprovar")}
        nomeUsuario={ctx.nome}
      />
    </div>
  );
}
