import Link from "next/link";
import { exigirCtx } from "@/lib/auth";
import { pode } from "@/lib/permissions";
import { chaveDia, deChave } from "@/lib/agenda";
import { ROTULO_FREQUENCIA } from "@/lib/rq/catalogo";
import { intervalo, MAX_DIAS_DOSSIE, resumoDossie } from "@/lib/servicos/dossie";
import { Alerta, Cabecalho, Indicador, Selo } from "@/components/ui";
import { BotaoGerarDossie } from "./gerar";

export const metadata = { title: "Preparar Auditoria MAPA" };

function presets(hoje: Date) {
  const h = chaveDia(hoje);
  const [a, m] = h.split("-").map(Number);
  const menos = (dias: number) => chaveDia(new Date(deChave(h).getTime() - dias * 86_400_000));
  const semestre = m <= 6 ? [`${a}-01-01`, h] : [`${a}-07-01`, h];
  return [
    { rotulo: "Últimos 30 dias", inicio: menos(29), fim: h },
    { rotulo: "Últimos 90 dias", inicio: menos(89), fim: h },
    { rotulo: "Semestre atual", inicio: semestre[0], fim: semestre[1] },
    { rotulo: "Últimos 12 meses", inicio: menos(364), fim: h },
  ];
}

export default async function Dossie({ searchParams }: { searchParams: Promise<{ inicio?: string; fim?: string }> }) {
  const ctx = await exigirCtx();
  if (!pode(ctx.perfil, "dossie:gerar")) return <Alerta>Seu perfil não gera o dossiê de fiscalização. Peça ao RT ou ao responsável da empresa.</Alerta>;
  const hoje = new Date();
  const opcoes = presets(hoje);
  const sp = await searchParams;
  const inicio = sp.inicio ?? opcoes[1].inicio;
  const fim = sp.fim ?? opcoes[1].fim;
  let erro: string | null = null;
  let resumo = null;
  try {
    const { de, ate } = intervalo(inicio, fim);
    resumo = await resumoDossie(ctx.tenantId, de, ate, hoje);
  } catch (e) {
    erro = (e as Error).message;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-10">
      <Cabecalho
        titulo="Preparar Auditoria MAPA"
        subtitulo="Compila em um único pacote todos os POPs e RQs do período, as não conformidades, os simulados de recall, a rastreabilidade, os cadastros e a trilha de auditoria."
      />
      <form className="cartao flex flex-wrap items-end gap-3">
        <label>
          <span className="rotulo">De</span>
          <input type="date" name="inicio" defaultValue={inicio} className="campo" />
        </label>
        <label>
          <span className="rotulo">Até</span>
          <input type="date" name="fim" defaultValue={fim} className="campo" />
        </label>
        <button className="btn-secundario">Atualizar resumo</button>
        <div className="flex flex-wrap gap-2 text-sm">
          {opcoes.map((o) => (
            <Link key={o.rotulo} href={`?inicio=${o.inicio}&fim=${o.fim}`} className={o.inicio === inicio && o.fim === fim ? "font-semibold text-marca-700" : "link"}>
              {o.rotulo}
            </Link>
          ))}
        </div>
      </form>

      {erro && <Alerta>{erro}</Alerta>}
      {resumo && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Indicador
              rotulo="Cobertura da agenda"
              valor={resumo.cobertura === null ? "—" : `${resumo.cobertura.toLocaleString("pt-BR")}%`}
              detalhe="períodos vencidos com RQ assinado"
              cor={resumo.cobertura === null ? "cinza" : resumo.cobertura >= 95 ? "verde" : resumo.cobertura >= 80 ? "amarelo" : "vermelho"}
            />
            <Indicador rotulo="Registros no período" valor={resumo.totalRegistros} detalhe="cada um vira um PDF assinado" cor="azul" />
            <Indicador rotulo="Não conformidades" valor={resumo.ncs.total} detalhe={`${resumo.ncs.encerradas} encerradas · ${resumo.ncs.abertas} em tratamento`} cor={resumo.ncs.abertas ? "amarelo" : "verde"} />
            <Indicador rotulo="Simulados de recall" valor={resumo.recalls} detalhe="POP 08" cor={resumo.recalls ? "verde" : "amarelo"} href="/recall" />
          </div>

          <section className="cartao flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-600">
              O pacote sai em ZIP, com índice em PDF, uma pasta por POP e o manifesto SHA-256 de cada arquivo. Períodos de até {MAX_DIAS_DOSSIE} dias.
            </div>
            <BotaoGerarDossie inicio={inicio} fim={fim} />
          </section>

          <section className="cartao overflow-x-auto">
            <h2 className="mb-3 font-semibold">Conferência por POP</h2>
            <table className="tabela">
              <thead>
                <tr>
                  <th>RQ</th>
                  <th>Registro</th>
                  <th>Frequência</th>
                  <th className="text-right">Cobertura</th>
                  <th className="text-right">Registros</th>
                  <th className="text-right">Conformes</th>
                  <th className="text-right">Fora do prazo</th>
                </tr>
              </thead>
              {resumo.pops.map((p) => (
                <tbody key={p.numero}>
                  <tr>
                    <td colSpan={7} className="bg-slate-50 font-semibold">
                      POP {String(p.numero).padStart(2, "0")} · {p.titulo}
                    </td>
                  </tr>
                  {p.rqs.map((r) => {
                    const falta = r.esperados !== null && r.cobertos < r.esperados;
                    return (
                      <tr key={r.codigoRq}>
                        <td className="font-mono">{r.codigoRq}</td>
                        <td>{r.titulo}</td>
                        <td>{ROTULO_FREQUENCIA[r.frequencia as keyof typeof ROTULO_FREQUENCIA]}</td>
                        <td className="text-right">{r.esperados === null ? <span className="text-slate-500">sob demanda</span> : <Selo cor={falta ? "vermelho" : "verde"}>{`${r.cobertos}/${r.esperados}`}</Selo>}</td>
                        <td className="text-right tabular-nums">{r.registros}</td>
                        <td className="text-right tabular-nums">{r.conformes}</td>
                        <td className="text-right tabular-nums">{r.atrasados}</td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </section>
        </>
      )}
    </div>
  );
}
