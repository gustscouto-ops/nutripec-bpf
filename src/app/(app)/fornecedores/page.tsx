import Link from "next/link";
import { exigirCtx } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pode } from "@/lib/permissions";
import { Cabecalho, Selo, Vazio, BotaoLink } from "@/components/ui";
import { COR_QUALIFICACAO, ROTULO_QUALIFICACAO, data } from "@/lib/formato";

export const metadata = { title: "Fornecedores" };

export default async function Fornecedores() {
  const ctx = await exigirCtx();
  const fornecedores = await prisma.fornecedor.findMany({
    where: { tenantId: ctx.tenantId },
    include: { materiasPrimas: { include: { materiaPrima: { select: { nomeComercial: true } } } } },
    orderBy: { razaoSocial: "asc" },
  });
  return (
    <div className="mx-auto max-w-7xl">
      <Cabecalho
        titulo="Fornecedores"
        subtitulo="Qualificação de fornecedores e matérias-primas autorizadas (POP 01). Só fornecedores aprovados podem entregar."
        acoes={pode(ctx.perfil, "cadastros:editar") && <BotaoLink href="/fornecedores/novo">+ Novo fornecedor</BotaoLink>}
      />
      <div className="cartao overflow-x-auto p-0 sm:p-0">
        {fornecedores.length ? (
          <table className="tabela">
            <thead>
              <tr>
                <th>Razão social</th>
                <th>CNPJ</th>
                <th>Registro MAPA</th>
                <th>Matérias-primas</th>
                <th>Qualificação</th>
              </tr>
            </thead>
            <tbody>
              {fornecedores.map((f) => (
                <tr key={f.id} className={f.ativo ? "" : "opacity-50"}>
                  <td>
                    <Link href={`/fornecedores/${f.id}`} className="link">{f.razaoSocial}</Link>
                    <div className="text-xs text-slate-500">{f.cidadeUf}</div>
                  </td>
                  <td className="whitespace-nowrap">{f.cnpj}</td>
                  <td>{f.registroMapa ?? <span className="text-red-600">Sem registro</span>}</td>
                  <td className="text-slate-600">
                    {f.materiasPrimas.map((m) => (
                      <span key={m.materiaPrimaId} className="mr-1 inline-block">
                        {m.materiaPrima.nomeComercial}
                        {!m.homologado && <span className="text-amber-700"> (não homol.)</span>};
                      </span>
                    ))}
                  </td>
                  <td>
                    <Selo cor={COR_QUALIFICACAO[f.statusQualificacao]}>{ROTULO_QUALIFICACAO[f.statusQualificacao]}</Selo>
                    {f.dataQualificacao && <div className="mt-1 text-xs text-slate-500">desde {data(f.dataQualificacao)}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Vazio>Nenhum fornecedor cadastrado.</Vazio>
        )}
      </div>
    </div>
  );
}
