import type { Perfil } from "@prisma/client";

export type Permissao =
  | "cadastros:editar"
  | "formula:aprovar"
  | "lote:decidir"
  | "operacao:registrar"
  | "usuarios:gerenciar"
  | "empresa:configurar"
  | "auditoria:ver";

const MATRIZ: Record<Perfil, Permissao[]> = {
  CEO: ["cadastros:editar", "operacao:registrar", "usuarios:gerenciar", "empresa:configurar", "auditoria:ver"],
  RT: [
    "cadastros:editar",
    "formula:aprovar",
    "lote:decidir",
    "operacao:registrar",
    "empresa:configurar",
    "auditoria:ver",
  ],
  CONSULTOR: [
    "cadastros:editar",
    "formula:aprovar",
    "lote:decidir",
    "operacao:registrar",
    "usuarios:gerenciar",
    "empresa:configurar",
    "auditoria:ver",
  ],
  OPERADOR: ["operacao:registrar"],
  AUDITOR: ["auditoria:ver"],
};

export function pode(perfil: Perfil, permissao: Permissao): boolean {
  return MATRIZ[perfil].includes(permissao);
}

export const ROTULO_PERFIL: Record<Perfil, string> = {
  CEO: "CEO / Proprietário",
  RT: "Responsável Técnico",
  CONSULTOR: "Consultor de BPF",
  OPERADOR: "Operador",
  AUDITOR: "Auditor Fiscal (leitura)",
};
