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
npx prisma migrate deploy
npx tsx prisma/producao.ts
exec npx next start -H 0.0.0.0 -p "${PORT:-3000}"
