import { prisma, num } from "../db";
import { ErroNegocio } from "../erros";
import type { DadosRotulo, NivelRotulo } from "../rotulo";

/** Monta os dados do rótulo a partir da fórmula (e, se informado, do lote produzido). */
export async function dadosRotulo(tenantId: string, alvo: { produtoId?: string; ordemId?: string }) {
  const ordem = alvo.ordemId ? await prisma.producaoOrdem.findFirst({ where: { id: alvo.ordemId, tenantId } }) : null;
  if (alvo.ordemId && !ordem) throw new ErroNegocio("Ordem de produção não encontrada.");
  const produtoId = ordem?.produtoId ?? alvo.produtoId;
  const produto = await prisma.produto.findFirst({
    where: { id: produtoId, tenantId },
    include: { tenant: true, itens: { include: { materiaPrima: { select: { nomeComercial: true, nomeTecnico: true } } }, orderBy: { percentual: "desc" } } },
  });
  if (!produto) throw new ErroNegocio("Produto não encontrado.");
  const t = produto.tenant;
  const dados: DadosRotulo = {
    empresa: { razaoSocial: t.razaoSocial, cnpj: t.cnpj, registroMapa: t.registroMapa, endereco: t.endereco, cidadeUf: t.cidadeUf },
    produto: {
      codigo: produto.codigo,
      nome: produto.nome,
      categoria: produto.categoria,
      especieDestino: produto.especieDestino,
      registroProduto: produto.registroProduto,
      pesoSacariaKg: num(produto.pesoSacariaKg),
      niveisGarantia: produto.niveisGarantia as unknown as NivelRotulo[],
      composicaoBasica: produto.composicaoBasica,
      ingredientes: produto.itens.map((i) => i.materiaPrima.nomeTecnico || i.materiaPrima.nomeComercial),
      substitutivos: produto.substitutivos,
      indicacaoUso: produto.indicacaoUso,
      modoUso: produto.modoUso,
      restricoes: produto.restricoes,
      conservacao: produto.conservacao,
      validadeDias: produto.validadeDias,
      versaoFormula: produto.versaoFormula,
    },
    lote: ordem ? { codigo: ordem.codigoLoteProduzido, fabricacao: ordem.dataHoraInicio, validade: ordem.dataValidade } : null,
  };
  const avisos: string[] = [];
  if (produto.statusFormula !== "APROVADA") avisos.push("A fórmula não está aprovada pelo RT: a impressão de etiquetas fica bloqueada.");
  if (ordem && ordem.versaoFormula !== produto.versaoFormula) {
    avisos.push(`O lote foi produzido com a versão ${ordem.versaoFormula} da fórmula e o cadastro está na versão ${produto.versaoFormula}. Confira se o texto do rótulo ainda vale para este lote.`);
  }
  return { dados, produto, ordem, aprovada: produto.statusFormula === "APROVADA", avisos };
}
