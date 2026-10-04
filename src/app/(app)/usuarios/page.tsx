import { exigirCtx } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROTULO_PERFIL } from "@/lib/permissions";
import { Cabecalho, Selo } from "@/components/ui";
import { alternarAcesso } from "./actions";
import { FormUsuario } from "./form";

export const metadata = { title: "Usuários" };

export default async function Usuarios() {
  const ctx = await exigirCtx("usuarios:gerenciar");
  const membros = await prisma.membership.findMany({
    where: { tenantId: ctx.tenantId },
    include: { user: true },
    orderBy: [{ ativo: "desc" }, { user: { nome: "asc" } }],
  });
  return (
    <div className="mx-auto max-w-6xl">
      <Cabecalho titulo="Usuários e perfis" subtitulo="Controle de acesso por empresa. Um mesmo login pode atuar em várias fábricas (ex.: consultor)." />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="cartao overflow-x-auto p-0 sm:p-0">
          <table className="tabela">
            <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Acesso</th></tr></thead>
            <tbody>
              {membros.map((m) => (
                <tr key={m.id} className={m.ativo ? "" : "opacity-50"}>
                  <td className="font-medium">{m.user.nome}<div className="text-xs font-normal text-slate-500">{[m.cargo, m.user.registroProfissional].filter(Boolean).join(" · ")}</div></td>
                  <td>{m.user.email}</td>
                  <td><Selo cor={m.perfil === "RT" ? "verde" : m.perfil === "AUDITOR" ? "cinza" : "azul"}>{ROTULO_PERFIL[m.perfil]}</Selo></td>
                  <td>
                    {m.userId === ctx.userId ? (
                      <span className="text-xs text-slate-500">você</span>
                    ) : (
                      <form action={alternarAcesso.bind(null, m.id)}>
                        <button className="text-sm font-medium text-marca-700 hover:underline">{m.ativo ? "Revogar" : "Reativar"}</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <FormUsuario />
      </div>
    </div>
  );
}
