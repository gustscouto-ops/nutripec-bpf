/**
 * Seed: 9 POPs obrigatórios + RQs padrão (globais) e duas fábricas de demonstração.
 * Senha de todos os usuários de demonstração: nutripec123
 */
import { PrismaClient, type Perfil } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CATALOGO_POPS } from "../src/lib/rq/catalogo";
import { salvarProduto, aprovarFormula } from "../src/lib/servicos/formula";
import { registrarRecebimento } from "../src/lib/servicos/recebimento";
import { registrarOrdem, registrarExpedicao, lotesDisponiveis } from "../src/lib/servicos/producao";
import type { Ctx } from "../src/lib/auth";

const prisma = new PrismaClient();

async function seedPops() {
  for (const pop of CATALOGO_POPS) {
    const p = await prisma.pop.upsert({
      where: { numeroPop: pop.numeroPop },
      update: { titulo: pop.titulo, descricaoProcedimento: pop.descricao },
      create: { numeroPop: pop.numeroPop, titulo: pop.titulo, descricaoProcedimento: pop.descricao },
    });
    for (const rq of pop.rqs) {
      await prisma.rqModelo.upsert({
        where: { codigoRq: rq.codigoRq },
        update: { titulo: rq.titulo, frequencia: rq.frequencia, campos: rq.campos },
        create: { popId: p.id, codigoRq: rq.codigoRq, titulo: rq.titulo, frequencia: rq.frequencia, campos: rq.campos },
      });
    }
  }
}

async function main() {
  await seedPops();
  if (await prisma.tenant.count()) {
    console.log("POPs atualizados. Empresas já existem — demonstração não recriada.");
    return;
  }

  const senhaHash = await bcrypt.hash("nutripec123", 10);
  const fabrica = await prisma.tenant.create({
    data: {
      razaoSocial: "Nutripec Indústria de Rações Ltda",
      nomeFantasia: "Nutripec Rações",
      cnpj: "12.345.678/0001-90",
      registroMapa: "SP-12345-1",
      cidadeUf: "Ribeirão Preto/SP",
      tipoPlano: "PROFISSIONAL",
    },
  });
  const fabrica2 = await prisma.tenant.create({
    data: {
      razaoSocial: "Boa Vista Nutrição Animal Ltda",
      nomeFantasia: "Boa Vista Nutrição",
      cnpj: "98.765.432/0001-10",
      registroMapa: "MG-54321-0",
      cidadeUf: "Uberaba/MG",
    },
  });

  const usuarios: { nome: string; email: string; perfil: Perfil; reg?: string; cargo: string; tenants: string[] }[] = [
    { nome: "Carlos Mendes", email: "ceo@nutripec.demo", perfil: "CEO", cargo: "Diretor", tenants: [fabrica.id] },
    { nome: "Dra. Ana Ribeiro", email: "rt@nutripec.demo", perfil: "RT", reg: "CRMV-SP 12345", cargo: "Médica Veterinária RT", tenants: [fabrica.id] },
    { nome: "João Silva", email: "operador@nutripec.demo", perfil: "OPERADOR", cargo: "Operador de recebimento", tenants: [fabrica.id] },
    { nome: "Marina Costa", email: "consultor@nutripec.demo", perfil: "CONSULTOR", reg: "CRZ 4567", cargo: "Consultora BPF", tenants: [fabrica.id, fabrica2.id] },
    { nome: "Fiscal MAPA", email: "auditor@nutripec.demo", perfil: "AUDITOR", cargo: "Auditor Fiscal Federal Agropecuário", tenants: [fabrica.id] },
  ];
  const ids: Record<string, string> = {};
  for (const u of usuarios) {
    const user = await prisma.user.create({ data: { nome: u.nome, email: u.email, senhaHash, registroProfissional: u.reg } });
    ids[u.perfil] = user.id;
    for (const tenantId of u.tenants) {
      await prisma.membership.create({ data: { userId: user.id, tenantId, perfil: u.perfil, cargo: u.cargo } });
    }
  }

  const ctx = (perfil: Perfil): Ctx => ({
    userId: ids[perfil],
    nome: usuarios.find((u) => u.perfil === perfil)!.nome,
    tenantId: fabrica.id,
    tenantNome: "Nutripec Rações",
    perfil,
    ip: "seed",
  });

  const mps = [
    { nomeComercial: "Milho moído", nomeTecnico: "Zea mays (grão moído)", prefixoLote: "MIL", categoria: "MACROINGREDIENTE", umidadeMaxPct: 14 },
    { nomeComercial: "Farelo de soja 46%", nomeTecnico: "Farelo de soja", prefixoLote: "FSO", categoria: "MACROINGREDIENTE", umidadeMaxPct: 12.5 },
    { nomeComercial: "Calcário calcítico", nomeTecnico: "Carbonato de cálcio", prefixoLote: "CAL", categoria: "MACROMINERAL" },
    { nomeComercial: "Fosfato bicálcico", nomeTecnico: "Fosfato bicálcico (18% P)", prefixoLote: "BIC", categoria: "MACROMINERAL" },
    { nomeComercial: "Sal comum", nomeTecnico: "Cloreto de sódio", prefixoLote: "SAL", categoria: "MACROMINERAL" },
    { nomeComercial: "Premix mineral bovinos", nomeTecnico: "Premix mineral e vitamínico", prefixoLote: "PMX", categoria: "PREMIX" },
    { nomeComercial: "Ureia pecuária", nomeTecnico: "Ureia (45% N)", prefixoLote: "URE", categoria: "ADITIVO" },
  ] as const;
  const mp: Record<string, string> = {};
  for (const m of mps) {
    const criado = await prisma.materiaPrima.create({ data: { ...m, tenantId: fabrica.id, temperaturaMaxC: 40 } });
    mp[m.prefixoLote] = criado.id;
  }

  const fornecedores = [
    { razaoSocial: "Cerealista Vale Verde Ltda", cnpj: "11.111.111/0001-11", registroMapa: "SP-00011-9", cidadeUf: "Orlândia/SP", status: "APROVADO", mps: ["MIL"] },
    { razaoSocial: "Agro Soja Comércio S.A.", cnpj: "22.222.222/0001-22", registroMapa: "PR-00022-8", cidadeUf: "Maringá/PR", status: "APROVADO", mps: ["FSO"] },
    { razaoSocial: "Mineração Calcário Paulista", cnpj: "33.333.333/0001-33", registroMapa: "SP-00033-7", cidadeUf: "Sorocaba/SP", status: "APROVADO", mps: ["CAL", "SAL"] },
    { razaoSocial: "FosfaBrasil Nutrição Animal", cnpj: "44.444.444/0001-44", registroMapa: "MG-00044-6", cidadeUf: "Uberaba/MG", status: "APROVADO", mps: ["BIC", "PMX", "URE"] },
    { razaoSocial: "Insumos Rápidos ME", cnpj: "55.555.555/0001-55", registroMapa: null, cidadeUf: "Franca/SP", status: "EM_AVALIACAO", mps: ["MIL"] },
  ] as const;
  const forn: Record<string, string> = {};
  for (const f of fornecedores) {
    const criado = await prisma.fornecedor.create({
      data: {
        tenantId: fabrica.id,
        razaoSocial: f.razaoSocial,
        cnpj: f.cnpj,
        registroMapa: f.registroMapa,
        cidadeUf: f.cidadeUf,
        statusQualificacao: f.status,
        dataQualificacao: f.status === "APROVADO" ? new Date("2026-01-15") : null,
        materiasPrimas: { create: f.mps.map((p) => ({ materiaPrimaId: mp[p], homologado: f.status === "APROVADO" })) },
      },
    });
    for (const p of f.mps) forn[p] ??= criado.id;
  }

  const c130 = await salvarProduto(ctx("RT"), null, {
    codigo: "C130",
    nome: "Concentrado 130 Bovinos de Corte",
    especieDestino: "Bovinos de corte",
    categoria: "Concentrado",
    tipoEmbalagem: "Saco de ráfia 25 kg",
    pesoSacariaKg: 25,
    tamanhoBateladaKg: 1000,
    indicacaoUso: "Suplemento concentrado para bovinos de corte em terminação.",
    modoUso: "Fornecer 1% do peso vivo/dia, misturado ao volumoso. Adaptação gradual de 14 dias.",
    composicaoBasica: "Milho moído, farelo de soja, calcário calcítico, fosfato bicálcico, cloreto de sódio, premix mineral e vitamínico, ureia pecuária.",
    restricoes: "Contém ureia: não fornecer a equinos, aves e suínos. Proibido o uso na alimentação de ruminantes de proteínas de origem animal.",
    niveisGarantia: [
      { nutriente: "Umidade (máx.)", valor: 130, unidade: "g/kg", tipo: "max" },
      { nutriente: "Proteína Bruta (mín.)", valor: 220, unidade: "g/kg", tipo: "min" },
      { nutriente: "Extrato Etéreo (mín.)", valor: 25, unidade: "g/kg", tipo: "min" },
      { nutriente: "Fibra Bruta (máx.)", valor: 60, unidade: "g/kg", tipo: "max" },
      { nutriente: "Cálcio (mín./máx.)", valor: 12, unidade: "g/kg" },
      { nutriente: "Fósforo (mín.)", valor: 6, unidade: "g/kg", tipo: "min" },
    ],
    base: "percentual",
    itens: [
      { materiaPrimaId: mp.MIL, percentual: 62 },
      { materiaPrimaId: mp.FSO, percentual: 28 },
      { materiaPrimaId: mp.CAL, percentual: 3 },
      { materiaPrimaId: mp.BIC, percentual: 2 },
      { materiaPrimaId: mp.SAL, percentual: 1.5 },
      { materiaPrimaId: mp.PMX, percentual: 2 },
      { materiaPrimaId: mp.URE, percentual: 1.5 },
    ],
  });
  await aprovarFormula(ctx("RT"), c130.id);

  await salvarProduto(ctx("RT"), null, {
    codigo: "SM80",
    nome: "Sal Mineral 80 P",
    especieDestino: "Bovinos",
    categoria: "Suplemento mineral",
    tipoEmbalagem: "Saco 30 kg",
    pesoSacariaKg: 30,
    tamanhoBateladaKg: 1500,
    niveisGarantia: [{ nutriente: "Fósforo (mín.)", valor: 80, unidade: "g/kg", tipo: "min" }],
    base: "batelada",
    itens: [
      { materiaPrimaId: mp.BIC, quantidadeBateladaKg: 675 },
      { materiaPrimaId: mp.SAL, quantidadeBateladaKg: 525 },
      { materiaPrimaId: mp.CAL, quantidadeBateladaKg: 180 },
      { materiaPrimaId: mp.PMX, quantidadeBateladaKg: 120 },
    ],
  });

  // Recebimentos de demonstração (todos conformes, exceto um milho com umidade alta → quarentena)
  const conforme = (umidade: number) => ({
    veiculo_limpo: { valor: "C" }, lona_integra: { valor: "C" }, sem_pragas: { valor: "C" }, sem_mofo: { valor: "C" },
    embalagem_integra: { valor: "NA" }, rotulagem: { valor: "C" }, carga_exclusiva: { valor: "C" }, laudo: { valor: "C" },
    nf_confere: { valor: "C" }, umidade: { valor: umidade }, temperatura: { valor: 28 },
  });
  const cargas: [string, string, number, string][] = [
    ["MIL", "100231", 30000, "VV-2209"],
    ["FSO", "55410", 14000, "AS-8812"],
    ["CAL", "9921", 3000, "MCP-110"],
    ["BIC", "7781", 2000, "FOS-882"],
    ["SAL", "9922", 1500, "MCP-111"],
    ["PMX", "7782", 2000, "PMX-2026-09"],
    ["URE", "7783", 1500, "URE-4410"],
  ];
  for (const [p, nf, kg, loteForn] of cargas) {
    await registrarRecebimento(ctx("OPERADOR"), {
      fornecedorId: forn[p], materiaPrimaId: mp[p], numeroNf: nf, quantidadeKg: kg, loteFornecedor: loteForn,
      placaVeiculo: "ABC1D23", respostas: conforme(p === "FSO" ? 11.8 : 12.1), fotos: [],
    });
  }
  const r = conforme(16.2);
  await registrarRecebimento(ctx("OPERADOR"), {
    fornecedorId: forn.MIL, materiaPrimaId: mp.MIL, numeroNf: "100245", quantidadeKg: 28000, loteFornecedor: "VV-2215",
    placaVeiculo: "XYZ9K87",
    respostas: { ...r, umidade: { valor: 16.2, descricaoNc: "Umidade de 16,2% acima do limite de 14%.", acaoCorretiva: "Carga segregada no silo pulmão 3 e encaminhada para secagem; RT acionado." } },
    observacoes: "Carga com cheiro de abafado na parte traseira.",
    fotos: [],
  });

  // Produção e expedição de demonstração
  const produto = await prisma.produto.findUniqueOrThrow({ where: { id: c130.id }, include: { itens: true } });
  const disp = await lotesDisponiveis(fabrica.id, produto.itens.map((i) => i.materiaPrimaId));
  const consumos = produto.itens.map((i) => ({
    loteMateriaPrimaId: disp.find((l) => l.materiaPrimaId === i.materiaPrimaId)!.id,
    quantidadeKg: Number(i.quantidadeBateladaKg) * 4,
  }));
  const ordem = await registrarOrdem(ctx("OPERADOR"), { produtoId: c130.id, turno: "MANHA", misturador: "Misturador horizontal 1 t", numeroBateladas: 4, consumos });
  await registrarExpedicao(ctx("OPERADOR"), {
    producaoOrdemId: ordem.id, clienteNome: "Fazenda Santa Luzia", clienteDocumento: "123.456.789-00", clienteCidadeUf: "Barretos/SP",
    numeroNf: "45001", placaVeiculo: "QWE4R56", quantidadeSacas: 100,
  });
  await registrarExpedicao(ctx("OPERADOR"), {
    producaoOrdemId: ordem.id, clienteNome: "Agropecuária Três Irmãos", clienteDocumento: "66.777.888/0001-99", clienteCidadeUf: "Bebedouro/SP",
    numeroNf: "45002", quantidadeSacas: 40,
  });

  console.log("Demonstração criada. Usuários (senha nutripec123):");
  for (const u of usuarios) console.log(`  ${u.perfil.padEnd(9)} ${u.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
