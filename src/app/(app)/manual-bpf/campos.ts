import type { DadosManual } from "@/lib/manual-bpf";

export const CAMPOS_EDITAVEIS = [
  "inscricaoEstadual",
  "logradouro",
  "bairro",
  "cidade",
  "uf",
  "cep",
  "telefone",
  "email",
  "atividade",
  "cabecalhoLinha1",
  "cabecalhoLinha2",
  "rtNome",
  "rtRegistro",
  "responsavelLegal",
  "responsavelFabrica",
  "controleQualidade",
  "dataEmissao",
  "revisao",
] as const satisfies readonly (keyof DadosManual)[];
