import { exigirCtx } from "@/lib/auth";
import { Cabecalho } from "@/components/ui";
import { FormSenha } from "./form";

export const metadata = { title: "Minha senha" };

export default async function MinhaSenha() {
  await exigirCtx();
  return (
    <div className="mx-auto max-w-md">
      <Cabecalho titulo="Minha senha" subtitulo="É a mesma senha usada para assinar os registros. Troque a senha inicial no primeiro acesso." />
      <FormSenha />
    </div>
  );
}
