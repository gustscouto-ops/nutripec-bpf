import Link from "next/link";
import { exigirCtx } from "@/lib/auth";
import { prisma, num } from "@/lib/db";
import { pode } from "@/lib/permissions";
import { Cabecalho, Vazio, BotaoLink, Selo } from "@/components/ui";
import { COR_FORMULA, ROTULO_FORMULA, data, kg } from "@/lib/formato";

export const metadata = { title: "Produtos e fórmulas" };

export default async function Produtos() {
  const ctx = await exigirCtx();
  const produtos = await prisma.produto.findMany({
    where: { tenantId: ctx.tenantId },
    include: { _count: { select: { itens: true } } },
    orderBy: { codigo: "asc" },
  });
  return (
    <div className="mx-auto max-w-7xl">
      <Cabecalho
        titulo="Produtos acabados e formulações"
        subtitulo="Fórmulas em base percentual ou batelada. A produção só é liberada após aprovação e assinatura do RT."
        acoes={pode(ctx.perfil, "cadastros:editar") && <BotaoLink href="/produtos/novo">+ Novo produto</BotaoLink>}
      />
      <div className="cartao overflow-x-auto p-0 sm:p-0">
        {produtos.length ? (
          <table className="tabela">
            <thead>
              <tr>
                <th>Código</th>
                <th>Produto</th>
                <th>Embalagem</th>
                <th>Batelada</th>
                <th>Ingredientes</th>
                <th>Fórmula</th>
              </tr>
            </thead>
            <tbody>
              {produtos.map((p) => (
                <tr key={p.id}>
                  <td className="font-mono">{p.codigo}</td>
                  <td>
                    <Link href={`/produtos/${p.id}`} className="link">{p.nome}</Link>
                    <div className="text-xs text-slate-500">{p.especieDestino}</div>
                  </td>
                  <td>{p.tipoEmbalagem ?? `${num(p.pesoSacariaKg)} kg`}</td>
                  <td>{kg(num(p.tamanhoBateladaKg))}</td>
                  <td>{p._count.itens}</td>
                  <td>
                    <Selo cor={COR_FORMULA[p.statusFormula]}>{ROTULO_FORMULA[p.statusFormula]}</Selo>
                    <div className="mt-1 text-xs text-slate-500">
                      v{p.versaoFormula}
                      {p.dataAprovacaoRt && ` · ${p.aprovadoRtNome} em ${data(p.dataAprovacaoRt)}`}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Vazio>Nenhum produto cadastrado.</Vazio>
        )}
      </div>
    </div>
  );
}
