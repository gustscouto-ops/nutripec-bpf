#!/bin/sh
# Entrada do contêiner: aplica as migrations, atualiza o catálogo e sobe o Next.js.
set -e
DIR="${STORAGE_DIR:-/data/storage}"
if [ "$(id -u)" = "0" ]; then
  # volumes da hospedagem (Railway, Render, Docker) chegam como root: prepara a pasta e segue sem privilégios
  mkdir -p "$DIR" && chown -R app:app "$DIR"
  HOME=/home/app exec setpriv --reuid=app --regid=app --init-groups sh "$0" "$@"
fi
mkdir -p "$DIR"
if [ "$SEED_DEMO" = "1" ] && [ -z "$AUTH_SECRET" ]; then
  # demonstração sem segredo configurado: gera um a cada início (só desloga quem estiver usando)
  AUTH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  export AUTH_SECRET
fi
npx prisma migrate deploy
if [ "$SEED_DEMO" = "1" ]; then
  npx tsx prisma/seed.ts   # demonstração: POPs + fábricas de exemplo (só se o banco estiver vazio)
else
  npx tsx prisma/producao.ts
fi
exec npx next start -H 0.0.0.0 -p "${PORT:-3000}"
