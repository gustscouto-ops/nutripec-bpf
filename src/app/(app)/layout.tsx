import { exigirCtx } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pode } from "@/lib/permissions";
import { ROTULO_PERFIL } from "@/lib/permissions";
import { Navegacao, type ItemMenu } from "@/components/navegacao";
import { sair } from "../login/actions";
import Link from "next/link";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await exigirCtx();
  const multiEmpresa = (await prisma.membership.count({ where: { userId: ctx.userId, ativo: true } })) > 1;

  const itens: ItemMenu[] = [
    { href: "/", rotulo: "Painel", icone: "painel" },
    { href: "/recebimento", rotulo: "Recebimento (RQ 1.2)", icone: "caminhao" },
    { href: "/producao", rotulo: "Produção", icone: "fabrica" },
    { href: "/expedicao", rotulo: "Expedição", icone: "saida" },
    { href: "/rastreabilidade", rotulo: "Rastreabilidade", icone: "rastreio" },
    { secao: "Cadastros" },
    { href: "/fornecedores", rotulo: "Fornecedores", icone: "fornecedor" },
    { href: "/materias-primas", rotulo: "Matérias-primas", icone: "saco" },
    { href: "/produtos", rotulo: "Produtos e fórmulas", icone: "formula" },
    { href: "/pops", rotulo: "POPs e RQs", icone: "pop" },
    { secao: "Gestão" },
    ...(pode(ctx.perfil, "auditoria:ver") ? [{ href: "/auditoria", rotulo: "Trilha de auditoria", icone: "auditoria" } as ItemMenu] : []),
    ...(pode(ctx.perfil, "usuarios:gerenciar") ? [{ href: "/usuarios", rotulo: "Usuários", icone: "usuarios" } as ItemMenu] : []),
    ...(pode(ctx.perfil, "empresa:configurar") ? [{ href: "/configuracoes", rotulo: "Configurações", icone: "config" } as ItemMenu] : []),
  ];

  const rodape = (
    <div className="border-t border-white/10 p-4 text-sm">
      <div className="font-semibold text-white">{ctx.nome}</div>
      <div className="text-marca-100">{ROTULO_PERFIL[ctx.perfil]}</div>
      <div className="mt-3 flex gap-2">
        {multiEmpresa && (
          <Link href="/selecionar-empresa" className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20">
            Trocar fábrica
          </Link>
        )}
        <form action={sair}>
          <button className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20">Sair</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      <Navegacao itens={itens} empresa={ctx.tenantNome} rodape={rodape} />
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
