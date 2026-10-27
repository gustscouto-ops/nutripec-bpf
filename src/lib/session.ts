import { SignJWT, jwtVerify } from "jose";
import type { Perfil } from "@prisma/client";

// Módulo compatível com o runtime do middleware (sem Prisma/bcrypt).

export const COOKIE_SESSAO = "nutripec_sessao";
const DURACAO_SEGUNDOS = 60 * 60 * 12; // um turno estendido

export type DadosSessao = {
  uid: string;
  nome: string;
  tid?: string; // empresa ativa
  perfil?: Perfil;
};

function chave() {
  const segredo = process.env.AUTH_SECRET;
  if (!segredo || segredo.length < 32) throw new Error("AUTH_SECRET ausente ou com menos de 32 caracteres");
  return new TextEncoder().encode(segredo);
}

export async function assinarSessao(dados: DadosSessao) {
  return new SignJWT(dados)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_SEGUNDOS}s`)
    .sign(chave());
}

export async function lerSessao(token: string | undefined): Promise<DadosSessao | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, chave());
    return payload as unknown as DadosSessao;
  } catch {
    return null;
  }
}

export const OPCOES_COOKIE = {
  httpOnly: true,
  sameSite: "lax" as const,
  // cookie só por HTTPS em produção; a demonstração local (APP_URL http://) também precisa abrir pelo IP da rede no celular
  secure: process.env.NODE_ENV === "production" && !process.env.APP_URL?.startsWith("http://"),
  path: "/",
  maxAge: DURACAO_SEGUNDOS,
};
