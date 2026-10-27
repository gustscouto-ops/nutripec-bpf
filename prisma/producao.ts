/**
 * Preparação do banco em produção (roda a cada deploy, depois do `prisma migrate deploy`).
 * - Atualiza os 9 POPs e os RQs padrão do sistema (nunca mexe nas versões das empresas).
 * - Primeiro acesso: se EMPRESA_CNPJ e ADMIN_EMAIL estiverem definidos, cria a empresa e o primeiro usuário
 *   (só o que ainda não existe). Não cria as fábricas de demonstração do seed.
 */
import { PrismaClient, type Perfil } from "@prisma/client";
import bcrypt from "bcryptjs";
import { sincronizarCatalogo } from "../src/lib/rq/sincronizar";

const prisma = new PrismaClient();
const PERFIS: Perfil[] = ["CEO", "RT", "CONSULTOR", "OPERADOR", "AUDITOR"];
const env = (nome: string) => process.env[nome]?.trim() || "";

async function primeiroAcesso() {
  const cnpj = env("EMPRESA_CNPJ");
  const email = env("ADMIN_EMAIL").toLowerCase();
  if (!cnpj || !email) return;

  let tenant = await prisma.tenant.findUnique({ where: { cnpj } });
  if (!tenant) {
    const razaoSocial = env("EMPRESA_RAZAO_SOCIAL");
    if (!razaoSocial) throw new Error("Defina EMPRESA_RAZAO_SOCIAL para criar a empresa.");
    tenant = await prisma.tenant.create({
      data: {
        razaoSocial,
        cnpj,
        nomeFantasia: env("EMPRESA_NOME_FANTASIA") || null,
        registroMapa: env("EMPRESA_REGISTRO_MAPA") || null,
        cidadeUf: env("EMPRESA_CIDADE_UF") || null,
      },
    });
    console.log(`Empresa criada: ${tenant.razaoSocial} (${cnpj}).`);
  }

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const senha = env("ADMIN_SENHA");
    const nome = env("ADMIN_NOME");
    if (senha.length < 8 || !nome) throw new Error("Defina ADMIN_NOME e ADMIN_SENHA (mínimo 8 caracteres) para criar o primeiro usuário.");
    user = await prisma.user.create({
      data: { nome, email, senhaHash: await bcrypt.hash(senha, 10), registroProfissional: env("ADMIN_REGISTRO") || null },
    });
    console.log(`Usuário criado: ${email}.`);
  }

  const perfil = (env("ADMIN_PERFIL").toUpperCase() || "CONSULTOR") as Perfil;
  if (!PERFIS.includes(perfil)) throw new Error(`ADMIN_PERFIL inválido: ${perfil}. Use ${PERFIS.join(", ")}.`);
  const vinculo = await prisma.membership.findUnique({ where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } } });
  if (!vinculo) {
    await prisma.membership.create({ data: { userId: user.id, tenantId: tenant.id, perfil, receberAlertas: true } });
    console.log(`Acesso de ${email} à empresa ${tenant.razaoSocial} como ${perfil}.`);
  }
}

async function main() {
  await sincronizarCatalogo(prisma);
  console.log("POPs e RQs padrão atualizados.");
  await primeiroAcesso();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
