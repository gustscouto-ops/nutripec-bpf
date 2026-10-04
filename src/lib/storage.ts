import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Armazenamento de arquivos (fotos de vistoria e PDFs).
 * Implementação em disco local; a interface é a mesma que será usada com S3/GCS.
 */

const raiz = () => path.resolve(process.env.STORAGE_DIR ?? "./storage");

export async function salvarArquivo(tenantId: string, conteudo: Buffer, extensao: string): Promise<string> {
  const agora = new Date();
  const chave = path.posix.join(
    tenantId,
    String(agora.getFullYear()),
    String(agora.getMonth() + 1).padStart(2, "0"),
    `${randomUUID()}.${extensao.replace(/[^a-z0-9]/gi, "")}`,
  );
  const destino = path.join(raiz(), chave);
  await mkdir(path.dirname(destino), { recursive: true });
  await writeFile(destino, conteudo, { flag: "wx" });
  return chave;
}

export async function lerArquivo(chave: string): Promise<Buffer> {
  const destino = path.resolve(raiz(), chave);
  if (!destino.startsWith(raiz() + path.sep)) throw new Error("Caminho inválido");
  return readFile(destino);
}
