import type { CampoRq } from "./campos";
import type { Frequencia } from "@prisma/client";

/** Os 9 POPs obrigatórios (IN MAPA 04/2007), na ordem dos manuais de BPF do setor, e suas RQs padrão. */

export const CAMPOS_RQ_1_2: CampoRq[] = [
  { id: "veiculo_limpo", rotulo: "Carroceria limpa, seca e sem odores estranhos", tipo: "conformidade" },
  { id: "lona_integra", rotulo: "Lona/cobertura íntegra, carga protegida de chuva", tipo: "conformidade" },
  { id: "sem_pragas", rotulo: "Ausência de insetos, roedores ou sinais de pragas", tipo: "conformidade" },
  { id: "sem_mofo", rotulo: "Ausência de mofo, empedramento ou fermentação", tipo: "conformidade" },
  { id: "embalagem_integra", rotulo: "Embalagens íntegras e sem contaminação (quando ensacado)", tipo: "conformidade" },
  { id: "rotulagem", rotulo: "Rotulagem/identificação do produto e lote do fornecedor", tipo: "conformidade" },
  { id: "carga_exclusiva", rotulo: "Sem carga mista com produtos químicos/tóxicos", tipo: "conformidade" },
  { id: "laudo", rotulo: "Laudo/certificado de análise do lote acompanha a carga", tipo: "conformidade" },
  { id: "nf_confere", rotulo: "NF confere com pedido (produto, quantidade, fornecedor)", tipo: "conformidade" },
  {
    id: "umidade",
    rotulo: "Umidade medida",
    tipo: "numerico",
    unidade: "%",
    min: 0,
    max: 14,
    limiteDinamico: "umidadeMaxPct",
    ajuda: "Limite padrão 14% (ou o definido no cadastro da matéria-prima)",
  },
  {
    id: "temperatura",
    rotulo: "Temperatura da carga",
    tipo: "numerico",
    unidade: "°C",
    max: 40,
    limiteDinamico: "temperaturaMaxC",
  },
];

const CONFORMIDADE = (id: string, rotulo: string): CampoRq => ({ id, rotulo, tipo: "conformidade" });

export type PopCatalogo = {
  numeroPop: number;
  titulo: string;
  descricao: string;
  rqs: { codigoRq: string; titulo: string; frequencia: Frequencia; campos: CampoRq[] }[];
};

export const CATALOGO_POPS: PopCatalogo[] = [
  {
    numeroPop: 1,
    titulo: "Qualificação de Fornecedores e Controle de Matérias-Primas e Embalagens",
    descricao:
      "Critérios de homologação de fornecedores, inspeção no recebimento, especificações de ingredientes e controle de materiais de embalagem primária e secundária.",
    rqs: [
      {
        codigoRq: "RQ 1.1",
        titulo: "Auditoria de Fornecedor",
        frequencia: "PERIODICA",
        campos: [
          CONFORMIDADE("registro_mapa", "Fornecedor possui registro vigente no MAPA"),
          CONFORMIDADE("bpf_implantado", "Programa de BPF implantado e documentado"),
          CONFORMIDADE("laudos", "Fornece laudos de análise por lote"),
          CONFORMIDADE("historico", "Histórico de entregas sem não conformidades graves"),
        ],
      },
      { codigoRq: "RQ 1.2", titulo: "Recebimento e Inspeção de Carga", frequencia: "QUANDO_OCORRE", campos: CAMPOS_RQ_1_2 },
    ],
  },
  {
    numeroPop: 2,
    titulo: "Limpeza e Higienização de Instalações, Equipamentos e Utensílios",
    descricao:
      "Frequência, métodos, produtos químicos autorizados, diluições e responsáveis pela limpeza das áreas internas, externas, máquinas e ferramentas de produção.",
    rqs: [
      {
        codigoRq: "RQ 2.1",
        titulo: "Limpeza Pré-Operacional Diária",
        frequencia: "DIARIA",
        campos: [
          CONFORMIDADE("piso", "Piso e áreas de circulação limpos"),
          CONFORMIDADE("moega", "Moega e elevadores sem resíduos"),
          CONFORMIDADE("misturador", "Misturador limpo e sem acúmulo"),
          CONFORMIDADE("ensaque", "Área de ensaque organizada"),
        ],
      },
      {
        codigoRq: "RQ 2.2",
        titulo: "Higienização Terminal/Profunda",
        frequencia: "MENSAL",
        campos: [CONFORMIDADE("silos", "Silos e roscas higienizados"), CONFORMIDADE("telhado", "Estruturas aéreas limpas")],
      },
    ],
  },
  {
    numeroPop: 3,
    titulo: "Higiene e Saúde do Pessoal",
    descricao:
      "Padrões de higiene pessoal, uso correto de uniformes e EPIs, controle de saúde dos colaboradores e regras de conduta na área fabril.",
    rqs: [
      {
        codigoRq: "RQ 3.1",
        titulo: "Checklist Diário de Asseio e Uniforme",
        frequencia: "DIARIA",
        campos: [
          CONFORMIDADE("uniforme", "Uniformes limpos e completos"),
          CONFORMIDADE("epi", "Uso de EPIs adequados"),
          CONFORMIDADE("adornos", "Ausência de adornos"),
        ],
      },
      {
        codigoRq: "RQ 3.2",
        titulo: "Controle de ASO e Exames",
        frequencia: "ANUAL",
        campos: [CONFORMIDADE("aso_vigente", "ASO vigente para todos os colaboradores")],
      },
    ],
  },
  {
    numeroPop: 4,
    titulo: "Potabilidade da Água e Higienização de Reservatórios",
    descricao:
      "Controle da qualidade físico-química e microbiológica da água utilizada na fábrica e rotina de limpeza e desinfecção de caixas d'água e cisternas.",
    rqs: [
      {
        codigoRq: "RQ 4.1",
        titulo: "Cloração Diária da Água",
        frequencia: "DIARIA",
        campos: [{ id: "cloro", rotulo: "Cloro residual livre", tipo: "numerico", unidade: "mg/L", min: 0.2, max: 2 }],
      },
      {
        codigoRq: "RQ 4.2",
        titulo: "Laudos Microbiológicos da Caixa d'Água",
        frequencia: "SEMESTRAL",
        campos: [CONFORMIDADE("laudo_potavel", "Laudo indica água potável")],
      },
    ],
  },
  {
    numeroPop: 5,
    titulo: "Prevenção de Contaminação Cruzada",
    descricao:
      "Medidas operacionais para evitar o contato indesejado entre matérias-primas, produtos com medicamentos e rações comuns, abrangendo o fluxo de produção e a limpeza de linhas.",
    rqs: [
      {
        codigoRq: "RQ 5.1",
        titulo: "Sequenciamento Diário de Bateladas",
        frequencia: "QUANDO_OCORRE",
        campos: [CONFORMIDADE("sequencia_respeitada", "Sequência de produção respeitada")],
      },
      {
        codigoRq: "RQ 5.2",
        titulo: "Procedimento de Flush / Linha Limpa",
        frequencia: "QUANDO_OCORRE",
        campos: [
          { id: "flush_kg", rotulo: "Quantidade de material de flush", tipo: "numerico", unidade: "kg", min: 0 },
          CONFORMIDADE("flush_destinado", "Flush identificado e destinado corretamente"),
        ],
      },
    ],
  },
  {
    numeroPop: 6,
    titulo: "Manutenção e Calibração de Equipamentos e Instrumentos",
    descricao:
      "Cronograma de manutenções preventivas e corretivas e calibração periódica de balanças, dosadores e instrumentos críticos para a qualidade do produto final.",
    rqs: [
      {
        codigoRq: "RQ 6.1",
        titulo: "Calibração de Balanças/Dosadores",
        frequencia: "SEMESTRAL",
        campos: [
          { id: "erro_balanca", rotulo: "Erro da balança com peso padrão", tipo: "numerico", unidade: "%", min: -0.5, max: 0.5 },
          CONFORMIDADE("certificado", "Certificado de calibração emitido"),
        ],
      },
      {
        codigoRq: "RQ 6.2",
        titulo: "Manutenção Preventiva de Misturadores",
        frequencia: "MENSAL",
        campos: [CONFORMIDADE("helicoides", "Helicoides/pás sem desgaste excessivo"), CONFORMIDADE("vedacao", "Comporta com vedação adequada")],
      },
    ],
  },
  {
    numeroPop: 7,
    titulo: "Controle Integrado de Pragas",
    descricao:
      "Prevenção da entrada e proliferação de insetos, roedores e aves, com uso seguro de domissanitários e monitoramento de armadilhas.",
    rqs: [
      {
        codigoRq: "RQ 7.1",
        titulo: "Monitoramento de Iscas e Armadilhas",
        frequencia: "SEMANAL",
        campos: [
          CONFORMIDADE("iscas_integras", "Porta-iscas íntegros e identificados"),
          { id: "capturas", rotulo: "Capturas/consumo identificados", tipo: "numerico", unidade: "un", min: 0, max: 0 },
        ],
      },
      {
        codigoRq: "RQ 7.2",
        titulo: "Certificado de Empresa Desinsetizadora",
        frequencia: "MENSAL",
        campos: [CONFORMIDADE("certificado_vigente", "Certificado de execução vigente")],
      },
    ],
  },
  {
    numeroPop: 8,
    titulo: "Controle de Resíduos e Efluentes",
    descricao:
      "Manejo, armazenamento temporário e destinação correta de resíduos sólidos (lixo comum, sobras, varreduras e embalagens) e efluentes gerados na fábrica.",
    rqs: [
      {
        codigoRq: "RQ 8.1",
        titulo: "Descarte de Embalagens Vazias e Varreduras",
        frequencia: "SEMANAL",
        campos: [
          CONFORMIDADE("segregacao", "Resíduos segregados e identificados"),
          { id: "varredura_kg", rotulo: "Varredura descartada", tipo: "numerico", unidade: "kg", min: 0 },
        ],
      },
    ],
  },
  {
    numeroPop: 9,
    titulo: "Programa de Rastreabilidade e Recolhimento de Produtos (Recall)",
    descricao:
      "Rastreio de lotes desde a matéria-prima até a expedição e passo a passo para o recolhimento rápido e seguro de produtos no mercado em caso de não conformidade grave.",
    rqs: [
      {
        codigoRq: "RQ 9.1",
        titulo: "Simulado de Recall / Rastreamento de Lote",
        frequencia: "SEMESTRAL",
        campos: [
          { id: "tempo_min", rotulo: "Tempo para rastrear o lote", tipo: "numerico", unidade: "min", max: 240 },
          CONFORMIDADE("rastreio_completo", "Rastreio completo (entrada → produção → saída)"),
        ],
      },
    ],
  },
];

export const ROTULO_FREQUENCIA: Record<Frequencia, string> = {
  DIARIA: "Diária",
  SEMANAL: "Semanal",
  QUINZENAL: "Quinzenal",
  MENSAL: "Mensal",
  SEMESTRAL: "Semestral",
  ANUAL: "Anual",
  PERIODICA: "Periódica",
  QUANDO_OCORRE: "Quando ocorre",
};
