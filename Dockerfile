# NutriPEC Gestão BPF — imagem de produção (Next.js 15 + Prisma + LibreOffice para o Manual de BPF)
# Ubuntu 24.04 traz o LibreOffice 24.2, a mesma versão em que o modelo do Manual foi validado (102 páginas com Carlito).
FROM node:22-bookworm-slim AS node

FROM ubuntu:24.04 AS base
ENV NEXT_TELEMETRY_DISABLED=1 DEBIAN_FRONTEND=noninteractive
WORKDIR /app
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
    && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS build
COPY . .
RUN npx prisma generate && npm run build

FROM base AS runner
# LibreOffice Writer converte o Manual de BPF (ODT → PDF). Fontes com as mesmas métricas das do modelo:
# Carlito/Caladea = Calibri/Cambria, Liberation = Arial/Times New Roman (sem elas o manual passa de 102 para 134 páginas)
RUN apt-get update && apt-get install -y --no-install-recommends \
      libreoffice-writer-nogui fonts-crosextra-carlito fonts-crosextra-caladea fonts-liberation fonts-liberation2 fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    STORAGE_DIR=/data/storage \
    PORT=3000 \
    TZ=America/Sao_Paulo
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/package.json /app/next.config.ts /app/tsconfig.json ./
COPY public ./public
COPY assets ./assets
COPY prisma ./prisma
COPY src ./src
COPY scripts ./scripts
# o script de entrada ajusta o dono do volume e roda o app como o usuário "app", sem root
RUN useradd --create-home --uid 1001 app && mkdir -p /data/storage && chown -R app:app /data /app/.next
EXPOSE 3000
CMD ["sh", "scripts/iniciar.sh"]
