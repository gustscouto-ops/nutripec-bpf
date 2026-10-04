import type { CampoRq } from "./campos";
import type { Frequencia } from "@prisma/client";

/** Os 9 POPs obrigatórios (IN MAPA 04/2007) e suas RQs padrão. */

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
    titulo: "Qualificação de Fornecedores e Matérias-Primas",
    descricao:
      "Estabelece critérios para seleção, avaliação e qualificação de fornecedores, e para inspeção e aceite de matérias-primas no recebimento.",
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
    titulo: "Limpeza e Higienização das Instalações e Equipamentos",
    descricao: "Define procedimentos, frequências e responsáveis pela limpeza das áreas, equipamentos e utensílios.",
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
    descricao: "Requisitos de higiene pessoal, uniformes, EPIs e controle de saúde dos colaboradores.",
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
    titulo: "Manutenção e Calibração de Equipamentos",
    descricao: "Programa de manutenção preventiva/corretiva e calibração de balanças, dosadores e instrumentos.",
    rqs: [
      {
        codigoRq: "RQ 4.1",
        titulo: "Calibração de Balanças/Dosadores",
        frequencia: "SEMESTRAL",
        campos: [
          { id: "erro_balanca", rotulo: "Erro da balança com peso padrão", tipo: "numerico", unidade: "%", min: -0.5, max: 0.5 },
          CONFORMIDADE("certificado", "Certificado de calibração emitido"),
        ],
      },
      {
        codigoRq: "RQ 4.2",
        titulo: "Manutenção Preventiva de Misturadores",
        frequencia: "MENSAL",
        campos: [CONFORMIDADE("helicoides", "Helicoides/pás sem desgaste excessivo"), CONFORMIDADE("vedacao", "Comporta com vedação adequada")],
      },
    ],
  },
  {
    numeroPop: 5,
    titulo: "Controle de Água de Consumo",
    descricao: "Garante a potabilidade da água usada na fábrica (cloração, limpeza de reservatórios e análises).",
    rqs: [
      {
        codigoRq: "RQ 5.1",
        titulo: "Cloração Diária da Água",
        frequencia: "DIARIA",
        campos: [{ id: "cloro", rotulo: "Cloro residual livre", tipo: "numerico", unidade: "mg/L", min: 0.2, max: 2 }],
      },
      {
        codigoRq: "RQ 5.2",
        titulo: "Laudos Microbiológicos da Caixa d'Água",
        frequencia: "SEMESTRAL",
        campos: [CONFORMIDADE("laudo_potavel", "Laudo indica água potável")],
      },
    ],
  },
  {
    numeroPop: 6,
    titulo: "Controle Integrado de Pragas e Vetores",
    descricao: "Medidas preventivas e corretivas para impedir a atração, abrigo e proliferação de pragas.",
    rqs: [
      {
        codigoRq: "RQ 6.1",
        titulo: "Monitoramento de Iscas e Armadilhas",
        frequencia: "SEMANAL",
        campos: [
          CONFORMIDADE("iscas_integras", "Porta-iscas íntegros e identificados"),
          { id: "capturas", rotulo: "Capturas/consumo identificados", tipo: "numerico", unidade: "un", min: 0, max: 0 },
        ],
      },
      {
        codigoRq: "RQ 6.2",
        titulo: "Certificado de Empresa Desinsetizadora",
        frequencia: "MENSAL",
        campos: [CONFORMIDADE("certificado_vigente", "Certificado de execução vigente")],
      },
    ],
  },
  {
    numeroPop: 7,
    titulo: "Prevenção de Contaminação Cruzada e Sequenciamento",
    descricao: "Sequenciamento de produção, limpeza de linha (flush) e segregação de medicamentos/aditivos.",
    rqs: [
      {
        codigoRq: "RQ 7.1",
        titulo: "Sequenciamento Diário de Bateladas",
        frequencia: "QUANDO_OCORRE",
        campos: [CONFORMIDADE("sequencia_respeitada", "Sequência de produção respeitada")],
      },
      {
        codigoRq: "RQ 7.2",
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
    numeroPop: 8,
    titulo: "Rastreabilidade e Recolhimento (Recall)",
    descricao: "Permite rastrear lotes da matéria-prima ao cliente e recolher produtos quando necessário.",
    rqs: [
      {
        codigoRq: "RQ 8.1",
        titulo: "Simulado de Recall / Rastreamento de Lote",
        frequencia: "SEMESTRAL",
        campos: [
          { id: "tempo_min", rotulo: "Tempo para rastrear o lote", tipo: "numerico", unidade: "min", max: 240 },
          CONFORMIDADE("rastreio_completo", "Rastreio completo (entrada → produção → saída)"),
        ],
      },
    ],
  },
  {
    numeroPop: 9,
    titulo: "Gestão de Resíduos e Embalagens",
    descricao: "Coleta, segregação, armazenamento temporário e destinação de resíduos, varreduras e embalagens.",
    rqs: [
      {
        codigoRq: "RQ 9.1",
        titulo: "Descarte de Embalagens Vazias e Varreduras",
        frequencia: "SEMANAL",
        campos: [
          CONFORMIDADE("segregacao", "Resíduos segregados e identificados"),
          { id: "varredura_kg", rotulo: "Varredura descartada", tipo: "numerico", unidade: "kg", min: 0 },
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
