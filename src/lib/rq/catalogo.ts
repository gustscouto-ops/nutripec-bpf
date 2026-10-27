import type { CampoRq } from "./campos";
import type { Frequencia } from "@prisma/client";

/**
 * Os 9 POPs obrigatórios (IN MAPA 04/2007, item 7.1), na ordem dos manuais de BPF do setor, e suas RQs padrão.
 * Cada item cita entre parênteses o requisito do Anexo I da IN que ele comprova; as orientações são impressas
 * no formulário em branco e no PDF do registro.
 */

const C = (id: string, rotulo: string, extra: Partial<CampoRq> = {}): CampoRq => ({ id, rotulo, tipo: "conformidade", ...extra });
const T = (id: string, rotulo: string, extra: Partial<CampoRq> = {}): CampoRq => ({ id, rotulo, tipo: "texto", ...extra });

export const CAMPOS_RQ_1_2: CampoRq[] = [
  C("veiculo_limpo", "Carroceria limpa, seca e sem odores estranhos (6.8.3)"),
  C("lona_integra", "Lona/cobertura íntegra, carga protegida de chuva (6.8.3)"),
  C("sem_pragas", "Ausência de insetos, roedores ou sinais de pragas (6.1.2)", { padrao: "Ausência" }),
  C("sem_mofo", "Ausência de mofo, empedramento ou fermentação (6.1.2)", { padrao: "Ausência" }),
  C("embalagem_integra", "Embalagens de primeiro uso, íntegras e sem contaminação, quando ensacado (6.5.2)"),
  C("rotulagem", "Rotulagem/identificação do produto e lote do fornecedor (6.8.1)"),
  C("ingrediente_registrado", "Ingrediente registrado no MAPA (ou dispensado) e fornecedor qualificado (6.1.1)"),
  C("validade", "Produto dentro do prazo de validade (6.8.2)"),
  C("carga_exclusiva", "Sem carga mista com produtos químicos/tóxicos (6.2.1)", { padrao: "Ausência" }),
  C("laudo", "Laudo/certificado de análise do lote acompanha a carga (6.1.3)"),
  C("nf_confere", "NF confere com pedido (produto, quantidade, fornecedor)"),
  C("descarga_coberta", "Descarga em local coberto, fora da área de produção (6.8.3)"),
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

export type RqCatalogo = {
  codigoRq: string;
  titulo: string;
  frequencia: Frequencia;
  campos: CampoRq[];
  orientacoes?: string;
};

export type PopCatalogo = {
  numeroPop: number;
  titulo: string;
  descricao: string;
  rqs: RqCatalogo[];
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
        titulo: "Qualificação e Auditoria de Fornecedor",
        frequencia: "PERIODICA",
        orientacoes:
          "Qualificar o fornecedor antes da primeira compra e reavaliar no mínimo uma vez ao ano. Fornecedor reprovado não entrega; material não aprovado vai para o local identificado de não aprovados (IN 04/2007, 6.1 e 7.5).",
        campos: [
          T("fornecedor", "Fornecedor avaliado e produtos fornecidos"),
          C("registro_mapa", "Estabelecimento fornecedor com registro vigente no MAPA (6.1.1)"),
          C("produto_registrado", "Produtos fornecidos registrados no MAPA ou dispensados de registro (6.1.1)"),
          C("bpf_implantado", "Programa de BPF implantado e documentado"),
          C("laudos", "Fornece laudos de análise por lote (6.1.3)"),
          C("especificacao", "Especificação técnica acordada (padrão de identidade e qualidade) (6.1.2)"),
          C("embalagem_primeiro_uso", "Embalagens de primeiro uso, íntegras e rotuladas (6.5.2)"),
          C("transporte", "Transporte em veículos limpos e adequados ao produto (6.8.3)"),
          C("historico", "Histórico de entregas sem não conformidades graves"),
          T("parecer", "Parecer: aprovado, aprovado com restrição ou reprovado", { padrao: "Aprovado" }),
        ],
      },
      {
        codigoRq: "RQ 1.2",
        titulo: "Recebimento e Inspeção de Carga",
        frequencia: "QUANDO_OCORRE",
        orientacoes:
          "Inspecionar toda carga antes da descarga. Carga não conforme fica em quarentena, identificada, no local de não aprovados, até a decisão do RT (IN 04/2007, 6.1.2, 6.8.3 e 7.5).",
        campos: CAMPOS_RQ_1_2,
      },
      {
        codigoRq: "RQ 1.3",
        titulo: "Armazenamento de Matérias-Primas, Embalagens e Produto Acabado",
        frequencia: "SEMANAL",
        orientacoes:
          "Matérias-primas e produtos acabados identificados e armazenados em separado, com PEPS e respeito à validade. Embalagens em área específica e, na área de envase, apenas as de uso imediato (IN 04/2007, 4.3.3, 4.3.4, 6.2.5, 6.5 e 6.8).",
        campos: [
          C("identificacao_separada", "MPs e produtos acabados identificados e armazenados em separado (6.2.5)"),
          C("paletes", "Sobre paletes/estrados, afastados das paredes, em bom estado (4.4.1)"),
          C("peps", "PEPS respeitado e nenhum produto vencido no estoque (6.8.2)"),
          C("sacaria_vazia", "Embalagens vazias em área específica e protegidas; só as de uso imediato no envase (6.5)"),
          C("nao_aprovados", "Local de não aprovados, devolvidos e recolhidos identificado e separado (4.3.4 e 4.3.24)"),
          C("medicamentos", "Medicamentos em área exclusiva, identificada e de acesso restrito, quando houver (4.3.3)"),
          { id: "temperatura_deposito", rotulo: "Temperatura do depósito de medicamentos", tipo: "numerico", unidade: "°C", max: 30, obrigatorio: false, ajuda: "Deixe em branco se a fábrica não usa medicamentos." },
        ],
      },
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
        orientacoes:
          "Seguir a IT de limpeza do POP 02 (método, produto, concentração e tempo de ação). Superfícies em contato com o produto sem resíduos de limpeza antes de produzir (IN 04/2007, 4.5 e 7.6).",
        campos: [
          C("piso", "Piso e áreas de circulação limpos (4.5.2)"),
          C("moega", "Moega e elevadores sem resíduos"),
          C("misturador", "Misturador limpo e sem acúmulo"),
          C("ensaque", "Área de ensaque organizada"),
          C("residuos_limpeza", "Sem resíduos de produtos de limpeza nas superfícies em contato com o produto (4.5.3)"),
          C("produtos_limpeza", "Produtos de limpeza registrados, identificados e guardados fora da produção (4.5.1)"),
          C("equip_manutencao", "Equipamentos em manutenção identificados (7.6)"),
        ],
      },
      {
        codigoRq: "RQ 2.2",
        titulo: "Higienização Terminal/Profunda",
        frequencia: "MENSAL",
        orientacoes:
          "Higienização completa das instalações conforme o POP 02, com desmonte dos equipamentos quando aplicável. Anotar produto e concentração usados (IN 04/2007, 4.3, 4.5.4 e 7.6).",
        campos: [
          C("silos", "Silos e roscas higienizados"),
          C("telhado", "Teto e estruturas aéreas limpos, sem mofo ou condensação (4.3.10)"),
          C("paredes", "Paredes, divisórias e pisos limpos e sem frestas (4.3.8 e 4.3.9)"),
          C("luminarias", "Luminárias protegidas e limpas (4.3.21)"),
          C("janelas_telas", "Janelas, telas e aberturas limpas e íntegras (4.3.11)"),
          C("vestiarios", "Vestiários e banheiros limpos e lavatórios abastecidos (4.3.15)"),
          C("area_externa", "Pátios e vias de acesso livres de entulho e lixo (4.3.25)"),
          T("produto_usado", "Produto(s), concentração e tempo de ação utilizados (7.6)"),
        ],
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
        orientacoes:
          "Verificar todos os colaboradores e visitantes antes do início das atividades. Colaborador com lesão ou sintoma de infecção é afastado da área de produção (IN 04/2007, 5.2 a 5.6 e 7.7).",
        campos: [
          C("uniforme", "Uniformes limpos, completos e de uso exclusivo no serviço (5.2)"),
          C("epi", "EPIs em uso e em perfeitas condições de higiene (5.5)"),
          C("adornos", "Ausência de adornos"),
          C("maos", "Mãos limpas, unhas curtas e lavagem antes de iniciar (5.5 e 7.7)"),
          C("saude", "Nenhum colaborador com lesão visível ou sintoma de infecção na área (5.4)", { padrao: "Ausência" }),
          C("habitos", "Sem comer, fumar ou guardar objetos pessoais na área de produção (5.3 e 4.5.9)"),
          C("visitantes", "Visitantes uniformizados e orientados (5.6)"),
        ],
      },
      {
        codigoRq: "RQ 3.2",
        titulo: "Controle de Saúde dos Colaboradores (ASO)",
        frequencia: "ANUAL",
        orientacoes:
          "Exames médicos e laboratoriais antes do início da atividade e repetidos no mínimo anualmente. Atestados e afastamentos arquivados (IN 04/2007, 5.4 e 7.7).",
        campos: [
          C("aso_vigente", "ASO vigente para todos os colaboradores (5.4)"),
          { id: "aso_vencido", rotulo: "Colaboradores com ASO vencido", tipo: "numerico", unidade: "pessoas", min: 0, max: 0 },
          C("admissional", "Novos colaboradores examinados antes do início das atividades (5.4)"),
          C("afastamentos", "Afastamentos por doença registrados com atestado (7.7)"),
        ],
      },
      {
        codigoRq: "RQ 3.3",
        titulo: "Registro de Treinamento",
        frequencia: "QUANDO_OCORRE",
        orientacoes:
          "Integração de novos funcionários e treinamento contínuo em BPF, higiene e nos POPs, inclusive de monitores e verificadores, com cronograma, carga horária, instrutor qualificado e avaliação de eficácia (IN 04/2007, 5.1, 6.4.1, 6.4.2 e 7.3).",
        campos: [
          T("tema", "Tema e conteúdo programático"),
          { id: "carga_horaria", rotulo: "Carga horária", tipo: "numerico", unidade: "h", min: 0.5 },
          T("instrutor", "Instrutor e qualificação"),
          T("participantes", "Participantes"),
          C("lista_presenca", "Lista de presença assinada e arquivada"),
          C("avaliacao_eficacia", "Avaliação de eficácia realizada (prova ou observação prática) (6.4.1)"),
        ],
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
        titulo: "Monitoramento Diário da Água (Cloro e pH)",
        frequencia: "DIARIA",
        orientacoes:
          "Padrão de potabilidade da Portaria GM/MS nº 888/2021: cloro residual livre de 0,2 a 2,0 mg/L e pH de 6,0 a 9,0. Fora do padrão: suspender o uso da água no processo e corrigir a cloração (IN 04/2007, 6.3.1 e 7.8).",
        campos: [
          { id: "cloro", rotulo: "Cloro residual livre", tipo: "numerico", unidade: "mg/L", min: 0.2, max: 2 },
          { id: "ph", rotulo: "pH", tipo: "numerico", min: 6, max: 9 },
          C("aspecto", "Água sem cor, odor ou turbidez aparente"),
          T("ponto_coleta", "Ponto de coleta"),
        ],
      },
      {
        codigoRq: "RQ 4.2",
        titulo: "Análise Laboratorial da Água",
        frequencia: "SEMESTRAL",
        orientacoes:
          "Coletar nos pontos definidos no POP 04 e enviar a laboratório. Padrão microbiológico: coliformes totais e Escherichia coli ausentes em 100 mL (Portaria GM/MS nº 888/2021; IN 04/2007, 7.8).",
        campos: [
          C("coliformes", "Coliformes totais", { padrao: "Ausência em 100 mL" }),
          C("ecoli", "Escherichia coli", { padrao: "Ausência em 100 mL" }),
          C("fisico_quimico", "Físico-químico dentro do padrão (cor, turbidez, pH)"),
          C("laudo_potavel", "Laudo conclui que a água é potável"),
          T("laboratorio", "Laboratório e número do laudo"),
        ],
      },
      {
        codigoRq: "RQ 4.3",
        titulo: "Higienização do Reservatório de Água",
        frequencia: "SEMESTRAL",
        orientacoes:
          "Limpar e desinfetar caixas d'água e cisternas no mínimo a cada 6 meses e após qualquer suspeita de contaminação; coletar amostra para análise depois da higienização (IN 04/2007, 7.8).",
        campos: [
          C("esvaziado", "Reservatório esvaziado e paredes escovadas sem produtos abrasivos"),
          C("desinfeccao", "Desinfecção com solução clorada na concentração e no tempo da IT"),
          T("produto", "Produto, concentração e tempo de contato"),
          C("tampa", "Reservatório tampado, vedado e sem rachaduras"),
          T("executado_por", "Executado por (colaborador ou empresa)"),
        ],
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
        orientacoes:
          "Seguir a sequência fixa de fabricação definida no POP 05, considerando ingredientes de origem animal, aditivos, produtos veterinários e a sensibilidade das espécies. É proibido usar proteína de origem animal em produtos para ruminantes (IN 04/2007, 6.2.2).",
        campos: [
          T("produtos_dia", "Produtos e lotes na ordem fabricada"),
          C("sequencia_respeitada", "Sequência de produção respeitada (6.2.2)"),
          C("medicamento_final", "Produtos com medicamento ao final da sequência, seguidos de limpeza/flush (6.2.2)"),
          C("especie_sensivel", "Sensibilidade das espécies respeitada (ex.: ruminantes sem ingrediente de origem animal)"),
        ],
      },
      {
        codigoRq: "RQ 5.2",
        titulo: "Procedimento de Flush / Linha Limpa",
        frequencia: "QUANDO_OCORRE",
        orientacoes:
          "Limpeza de linha entre produtos conforme a sequência do POP 05. O material de flush é identificado e armazenado em local próprio até a destinação (IN 04/2007, 6.2.3).",
        campos: [
          T("produto_anterior", "Produto anterior e produto seguinte"),
          { id: "flush_kg", rotulo: "Quantidade de material de flush", tipo: "numerico", unidade: "kg", min: 0 },
          C("flush_identificado", "Flush identificado e armazenado em local próprio (6.2.3)"),
          C("flush_destinado", "Flush destinado conforme o POP (reprocesso no mesmo produto ou descarte)"),
        ],
      },
      {
        codigoRq: "RQ 5.3",
        titulo: "Verificação da Eficácia da Limpeza de Linha",
        frequencia: "SEMESTRAL",
        orientacoes:
          "Os procedimentos de limpeza entre produtos devem ser validados e verificados periodicamente. Resultado insatisfatório: rever a sequência ou usar linhas separadas (IN 04/2007, 6.2.3 e 6.2.4).",
        campos: [
          T("metodo", "Método usado (traçador, análise da primeira saída etc.)"),
          { id: "arraste", rotulo: "Arraste (carry-over) encontrado", tipo: "numerico", unidade: "%", min: 0 },
          C("eficaz", "Resultado dentro do limite definido pelo RT"),
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
        titulo: "Calibração de Balanças e Instrumentos",
        frequencia: "SEMESTRAL",
        orientacoes:
          "Calibração por empresa ou laboratório com rastreabilidade à RBC/Inmetro, de cada balança e instrumento do processo. Instrumento fora da tolerância fica identificado e fora de uso até o ajuste (IN 04/2007, 7.10).",
        campos: [
          T("instrumento", "Instrumento e número de série/identificação"),
          { id: "erro_balanca", rotulo: "Erro da balança com peso padrão", tipo: "numerico", unidade: "%", min: -0.5, max: 0.5 },
          C("certificado", "Certificado de calibração emitido"),
          C("rbc", "Calibração rastreável à RBC/Inmetro"),
          C("etiqueta", "Instrumento identificado com etiqueta de calibração e validade"),
        ],
      },
      {
        codigoRq: "RQ 6.2",
        titulo: "Manutenção Preventiva de Equipamentos",
        frequencia: "MENSAL",
        orientacoes:
          "Seguir o cronograma de manutenção do POP 06. Equipamento em manutenção fica identificado e só volta à produção limpo e liberado (IN 04/2007, 4.4.3, 4.5.1, 7.6 e 7.10).",
        campos: [
          C("helicoides", "Helicoides/pás sem desgaste excessivo"),
          C("vedacao", "Comporta com vedação adequada"),
          C("lubrificante", "Lubrificantes de grau alimentício onde há contato com o produto (4.5.1)"),
          C("vazamentos", "Sem vazamentos de óleo, peças soltas ou ferrugem sobre o produto (4.4.3)", { padrao: "Ausência" }),
          C("imas", "Ímãs e peneiras limpos e íntegros"),
          C("liberacao", "Equipamento identificado durante a manutenção e liberado limpo (7.6)"),
        ],
      },
      {
        codigoRq: "RQ 6.3",
        titulo: "Aferição das Balanças",
        frequencia: "SEMANAL",
        orientacoes:
          "Aferir cada balança com peso padrão identificado. Erro (%) = (leitura - peso padrão) / peso padrão x 100. Fora da tolerância: suspender o uso, anotar o fator de correção e acionar a calibração. Observar a IT de aferição do POP 06 (IN 04/2007, 7.10).",
        campos: [
          T("peso_padrao", "Peso padrão usado (kg) e identificação"),
          { id: "balanca_macro", rotulo: "Balança de macroingredientes: erro", tipo: "numerico", unidade: "%", min: -0.5, max: 0.5 },
          { id: "balanca_micro", rotulo: "Balança de microingredientes: erro", tipo: "numerico", unidade: "%", min: -0.5, max: 0.5 },
          { id: "balanca_ensaque", rotulo: "Balança de ensaque: erro", tipo: "numerico", unidade: "%", min: -0.5, max: 0.5 },
        ],
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
        titulo: "Monitoramento de Iscas, Armadilhas e Barreiras",
        frequencia: "SEMANAL",
        orientacoes:
          "Inspecionar todos os porta-iscas do mapa e as barreiras físicas. Captura ou consumo de isca é não conformidade: registrar, acionar a controladora e reforçar as barreiras (IN 04/2007, 4.3.11, 4.5.6, 4.5.7 e 7.11).",
        campos: [
          C("iscas_integras", "Porta-iscas íntegros, fixados e identificados conforme o mapa"),
          { id: "capturas", rotulo: "Capturas/consumo identificados", tipo: "numerico", unidade: "un", min: 0, max: 0 },
          C("portas_telas", "Portas, janelas e aberturas com telas/vedação íntegras (4.3.11)"),
          C("sem_animais", "Ausência de animais domésticos e aves nas áreas internas (4.5.6)", { padrao: "Ausência" }),
          C("area_externa", "Áreas externas sem entulho, mato alto ou água parada (4.3.25)"),
        ],
      },
      {
        codigoRq: "RQ 7.2",
        titulo: "Controle Químico por Empresa Especializada",
        frequencia: "MENSAL",
        orientacoes:
          "Registrar grupo químico, nome, princípio ativo, concentração, local e forma de aplicação e o responsável. A empresa terceirizada deve ter registro próprio no órgão competente; nenhum produto é aplicado sobre ingredientes ou rações (IN 04/2007, 4.5.8 e 7.11).",
        campos: [
          C("certificado_vigente", "Certificado de execução do serviço emitido"),
          C("empresa_licenciada", "Empresa com licença no órgão competente e responsável técnico (7.11)"),
          T("produtos", "Produto, grupo químico, princípio ativo e concentração (7.11)"),
          T("local_aplicacao", "Local e forma de aplicação"),
          C("fispq", "Produtos registrados, com FISPQ disponível e guardados em área própria (4.5.8)"),
          C("mapa_iscas", "Mapa de localização das iscas atualizado"),
        ],
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
        titulo: "Descarte de Resíduos, Embalagens Vazias e Varreduras",
        frequencia: "SEMANAL",
        orientacoes:
          "Lixo e resíduos removidos de forma a não contaminar produtos e água, guardados em local isolado e identificado até a destinação. Registrar o destino e o responsável (IN 04/2007, 4.3.23, 4.5.5 e 7.12).",
        campos: [
          C("segregacao", "Resíduos segregados e identificados"),
          { id: "varredura_kg", rotulo: "Varredura descartada", tipo: "numerico", unidade: "kg", min: 0 },
          C("local_lixo", "Local de lixo isolado da produção, identificado, tampado e limpo (4.3.23)"),
          T("destinacao", "Destino dos resíduos e responsável pela destinação (7.12)"),
          C("comprovante", "Comprovante de destinação (MTR ou recibo) arquivado"),
        ],
      },
      {
        codigoRq: "RQ 8.2",
        titulo: "Controle de Efluentes e Águas Residuais",
        frequencia: "MENSAL",
        orientacoes:
          "O sistema de tratamento e eliminação de águas residuais deve ser eficaz e aprovado pelo órgão ambiental competente (IN 04/2007, 4.3.20 e 7.12).",
        campos: [
          C("sistema_tratamento", "Sistema de tratamento funcionando e aprovado pelo órgão ambiental (4.3.20)"),
          C("caixas", "Caixas de gordura, fossas e sumidouros limpos e sem transbordo"),
          C("ralos", "Ralos sifonados e fechados, sem poças na área de produção (4.3.8)"),
          T("licenca", "Licença ambiental e validade", { obrigatorio: false }),
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
        orientacoes:
          "Escolher um lote e rastrear da origem das matérias-primas ao destino final do produto acabado. Produtos recolhidos ficam identificados e segregados até a destinação (IN 04/2007, 4.3.24 e 7.13).",
        campos: [
          { id: "tempo_min", rotulo: "Tempo para rastrear o lote", tipo: "numerico", unidade: "min", max: 240 },
          C("rastreio_completo", "Rastreio completo (entrada, produção e saída)"),
        ],
      },
      {
        codigoRq: "RQ 9.2",
        titulo: "Reclamações, Devoluções e Recolhimentos",
        frequencia: "QUANDO_OCORRE",
        orientacoes:
          "Registrar reclamações, sugestões e elogios de funcionários e clientes. Reclamação que indique risco ao animal abre não conformidade e avaliação de recall pelo POP 09 (IN 04/2007, 4.3.24, 7.13 e 8.1).",
        campos: [
          T("tipo", "Tipo: reclamação, sugestão, elogio, devolução ou recolhimento"),
          T("cliente", "Cliente ou funcionário e contato"),
          T("lote", "Produto e lote envolvidos"),
          T("descricao", "Descrição do ocorrido"),
          C("produto_segregado", "Produto devolvido/recolhido identificado e segregado em local próprio (4.3.24)"),
          T("providencia", "Providência tomada e resposta ao cliente"),
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
