"use client";

export type Foto = { blob: Blob; url: string; descricao: string };

/** Reduz a foto da câmera (~1600 px, JPEG) antes do envio: economiza dados no Wi-Fi da fábrica. */
export async function comprimir(arquivo: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(arquivo);
    const escala = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * escala);
    canvas.height = Math.round(bmp.height * escala);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return await new Promise((ok) => canvas.toBlob((b) => ok(b ?? arquivo), "image/jpeg", 0.8));
  } catch {
    return arquivo;
  }
}

/** Anexa as fotos ao FormData no formato esperado pelas Server Actions (campos "fotos" e "descricoes"). */
export function anexarFotos(fd: FormData, fotos: Foto[]) {
  fotos.forEach((f, i) => {
    fd.append("fotos", new File([f.blob], `foto-${i + 1}.jpg`, { type: f.blob.type || "image/jpeg" }));
    fd.append("descricoes", f.descricao);
  });
}

/** Captura de evidências pela câmera do aparelho, com descrição por foto. */
export function Fotos({ fotos, onChange, max }: { fotos: Foto[]; onChange: (f: Foto[]) => void; max: number }) {
  async function adicionar(arquivos: FileList | null) {
    if (!arquivos) return;
    const novas = await Promise.all(
      [...arquivos].slice(0, max - fotos.length).map(async (f) => {
        const blob = await comprimir(f);
        return { blob, url: URL.createObjectURL(blob), descricao: "" };
      }),
    );
    onChange([...fotos, ...novas]);
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {fotos.map((f, i) => (
        <div key={f.url} className="overflow-hidden rounded-lg border border-slate-200">
          <img src={f.url} alt={`Foto ${i + 1}`} className="aspect-[4/3] w-full object-cover" />
          <div className="space-y-1 p-2">
            <input
              value={f.descricao}
              onChange={(e) => onChange(fotos.map((x, j) => (j === i ? { ...x, descricao: e.target.value } : x)))}
              placeholder="Descrição"
              className="campo py-1.5 text-sm"
            />
            <button type="button" onClick={() => onChange(fotos.filter((_, j) => j !== i))} className="text-sm font-medium text-red-600">
              Remover
            </button>
          </div>
        </div>
      ))}
      {fotos.length < max && (
        <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-slate-600 hover:border-marca-500">
          <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M3 8h3l2-3h8l2 3h3v12H3z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          <span className="mt-1 text-sm font-medium">Tirar foto</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => {
              adicionar(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      )}
    </div>
  );
}
