import { exigirCtx } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pode } from "@/lib/permissions";
import { chaveDia } from "@/lib/agenda";
import { dataHora } from "@/lib/formato";
import { fmtDataBr } from "@/lib/manual-bpf";
import { dadosManual, emissaoVencida } from "@/lib/servicos/manual-bpf";
import { Alerta, Cabecalho, Selo } from "@/components/ui";
import { FormManual } from "./form";
import { BotaoGerarManual } from "./gerar";

export const metadata = { title: "Manual de BPF" };

export default async function ManualBpf() {
  const ctx = await exigirCtx();
  if (!pode(ctx.perfil, "dossie:gerar")) return <Alerta>Seu perfil não emite o Manual de BPF. Peça ao RT ou ao responsável da empresa.</Alerta>;
  const hoje = new Date();
  const [{ dados, salvo }, emissoes] = await Promise.all([
    dadosManual(ctx.tenantId, hoje),
    prisma.manualBpfEmissao.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { numero: "desc" } }),
  ]);
  const vencida = salvo && emissaoVencida(dados.dataEmissao, hoje);

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-10">
      <Cabecalho
        titulo="Manual de Boas Práticas de Fabricação"
        subtitulo="MB01 e POP 01 a 09 com os registros de autocontrole, no layout do modelo da consultoria. O sistema troca o nome da indústria, os responsáveis do rodapé e a data de emissão."
      />
      <section className="cartao flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">Edição atual:</span> emissão {fmtDataBr(dados.dataEmissao)}, revisão {dados.revisao}
            {!salvo && <Selo cor="amarelo">dados ainda não salvos</Selo>}
            {vencida && <Selo cor="vermelho">emitido há mais de 1 ano</Selo>}
          </div>
          <p className="text-slate-600">O PDF usa os dados salvos. Gerar de novo sem mudar nada baixa a mesma edição.</p>
        </div>
        <BotaoGerarManual habilitado={salvo} />
      </section>
      {vencida && <Alerta tipo="aviso">A emissão tem mais de um ano. Use “Nova emissão anual”, salve e gere o PDF para imprimir a nova edição.</Alerta>}

      <FormManual inicial={dados} hoje={chaveDia(hoje)} podeEditar={pode(ctx.perfil, "empresa:configurar")} />

      <section className="cartao space-y-3">
        <h2 className="font-semibold">Edições emitidas</h2>
        {emissoes.length ? (
          <div className="overflow-x-auto">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Nº</th>
                  <th>Emissão</th>
                  <th>Revisão</th>
                  <th>Páginas</th>
                  <th>Gerado por</th>
                  <th>Em</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {emissoes.map((e) => (
                  <tr key={e.id}>
                    <td>{e.numero}</td>
                    <td>{fmtDataBr(e.dataEmissao)}</td>
                    <td>{e.revisao}</td>
                    <td>{e.paginas}</td>
                    <td>{e.userNome}</td>
                    <td>{dataHora(e.createdAt)}</td>
                    <td>
                      <a href={`/api/manual-bpf/${e.id}`} target="_blank" className="link">
                        Abrir PDF
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Nenhuma edição emitida ainda.</p>
        )}
      </section>
    </div>
  );
}
