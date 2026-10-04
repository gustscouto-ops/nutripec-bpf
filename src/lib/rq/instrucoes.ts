/** Instruções de Trabalho (ITs) padrão, vinculadas aos POPs. A empresa pode editar a sua versão. */

export type PassoIt = { texto: string; alerta?: string; fotoUrl?: string };
export type ItCatalogo = { codigo: string; popNumero: number; titulo: string; objetivo: string; passos: PassoIt[] };

export const CATALOGO_ITS: ItCatalogo[] = [
  {
    codigo: "IT 01.01",
    popNumero: 1,
    titulo: "Inspeção de carga no recebimento",
    objetivo: "Padronizar a inspeção do caminhão e da matéria-prima antes da descarga (RQ 1.2).",
    passos: [
      { texto: "Confira a nota fiscal com o pedido: produto, quantidade e fornecedor homologado." },
      { texto: "Antes de abrir a lona, verifique a carroceria: limpa, seca e sem cheiro estranho." },
      { texto: "Abra a lona e procure rasgos, sinais de chuva, insetos, roedores ou fezes.", alerta: "Se houver produto químico ou tóxico junto da carga, NÃO descarregue e chame o RT." },
      { texto: "Retire amostra de 3 pontos (frente, meio e fundo) e meça a umidade e a temperatura." },
      { texto: "Observe mofo, empedramento e odor de fermentação na amostra." },
      { texto: "Confira se o laudo de análise do lote acompanha a carga." },
      { texto: "Fotografe a carga, a lona e qualquer problema encontrado." },
      { texto: "Registre o RQ 1.2 no tablet e assine com sua senha. O sistema gera o lote interno: escreva-o na identificação do silo ou da pilha." },
    ],
  },
  {
    codigo: "IT 02.01",
    popNumero: 2,
    titulo: "Limpeza a seco do misturador",
    objetivo: "Remover resíduos do misturador sem uso de água, antes do início da produção.",
    passos: [
      { texto: "Desligue o misturador e bloqueie a chave elétrica (cadeado e etiqueta).", alerta: "Nunca entre no equipamento energizado." },
      { texto: "Abra a comporta de descarga e as janelas de inspeção." },
      { texto: "Raspe as paredes e as pás com espátula de plástico, de cima para baixo." },
      { texto: "Aspire o resíduo; não use ar comprimido para não espalhar pó." },
      { texto: "Descarte o resíduo como varredura (POP 09) e registre no RQ 2.1." },
    ],
  },
  {
    codigo: "IT 03.01",
    popNumero: 3,
    titulo: "Higienização das mãos e uso do uniforme",
    objetivo: "Evitar contaminação do produto pelo manipulador.",
    passos: [
      { texto: "Retire anéis, relógio, brincos e outros adornos." },
      { texto: "Molhe as mãos, aplique sabonete e esfregue por 20 segundos, inclusive entre os dedos e as unhas." },
      { texto: "Enxágue, seque com papel toalha e aplique álcool 70%." },
      { texto: "Vista o uniforme limpo, a touca cobrindo todo o cabelo e as botas de segurança." },
    ],
  },
  {
    codigo: "IT 04.01",
    popNumero: 4,
    titulo: "Verificação da balança com peso padrão",
    objetivo: "Confirmar a exatidão das balanças de dosagem (RQ 4.1).",
    passos: [
      { texto: "Limpe o prato da balança e zere o indicador (tara)." },
      { texto: "Coloque o peso padrão certificado no centro do prato." },
      { texto: "Anote a leitura e calcule o erro: (leitura − peso padrão) ÷ peso padrão × 100." },
      { texto: "Repita nos quatro cantos do prato.", alerta: "Erro acima de ±0,5%: interdite a balança e chame a manutenção." },
    ],
  },
  {
    codigo: "IT 05.01",
    popNumero: 5,
    titulo: "Medição do cloro residual livre",
    objetivo: "Garantir a potabilidade da água de consumo (RQ 5.1).",
    passos: [
      { texto: "Deixe a água da torneira de coleta correr por 1 minuto." },
      { texto: "Encha a cubeta do kit até a marca e adicione o reagente DPD." },
      { texto: "Compare a cor com a escala em até 1 minuto e anote o valor em mg/L." },
      { texto: "Faixa aceitável: 0,2 a 2,0 mg/L.", alerta: "Fora da faixa: avise o RT e ajuste o dosador de cloro." },
    ],
  },
  {
    codigo: "IT 06.01",
    popNumero: 6,
    titulo: "Inspeção dos porta-iscas e armadilhas",
    objetivo: "Monitorar a presença de pragas conforme o mapa de iscas (RQ 6.1).",
    passos: [
      { texto: "Siga a numeração do mapa de iscas, sem pular pontos." },
      { texto: "Verifique se o porta-iscas está fixo, fechado e identificado." },
      { texto: "Registre consumo de isca, captura ou fezes encontradas." },
      { texto: "Não manuseie a isca sem luvas.", alerta: "Iscas raticidas são tóxicas: nunca deixe perto de matéria-prima." },
    ],
  },
  {
    codigo: "IT 07.01",
    popNumero: 7,
    titulo: "Limpeza de linha (flush) após produto com medicamento",
    objetivo: "Evitar contaminação cruzada entre bateladas (RQ 7.2).",
    passos: [
      { texto: "Após produzir ração com medicamento, separe o próximo produto conforme a sequência aprovada pelo RT." },
      { texto: "Passe pelo misturador e pelas roscas a quantidade de flush definida (ex.: 10% da batelada de milho moído)." },
      { texto: "Identifique o flush com etiqueta vermelha e destine-o conforme orientação do RT." },
      { texto: "Registre a quantidade e o destino no RQ 7.2." },
    ],
  },
  {
    codigo: "IT 08.01",
    popNumero: 8,
    titulo: "Simulado de recall",
    objetivo: "Testar a capacidade de rastrear um lote em até 4 horas (RQ 8.1).",
    passos: [
      { texto: "O RT sorteia um lote de produto acabado ou de matéria-prima." },
      { texto: "Cronometre a partir do início da busca em Rastreabilidade." },
      { texto: "Liste insumos, NFs, fornecedores, clientes e saldo em estoque." },
      { texto: "Registre o tempo e o resultado no RQ 8.1 e imprima o relatório de rastreabilidade." },
    ],
  },
  {
    codigo: "IT 09.01",
    popNumero: 9,
    titulo: "Descarte de embalagens vazias e varreduras",
    objetivo: "Destinar corretamente os resíduos da produção (RQ 9.1).",
    passos: [
      { texto: "Separe sacarias vazias de premix/medicamentos das demais embalagens." },
      { texto: "Pese a varredura do dia e armazene em tambor identificado como 'NÃO USAR NA PRODUÇÃO'." },
      { texto: "Entregue os resíduos somente a empresa licenciada e guarde o comprovante." },
    ],
  },
];
