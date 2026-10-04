# NutriPEC Gestão BPF

SaaS de Gestão da Qualidade e Boas Práticas de Fabricação para fábricas de ração e suplementos,
ancorado na **IN MAPA nº 04/2007**. Este repositório contém a **Fase 1 (MVP)** do roadmap.

## O que a Fase 1 entrega

| Módulo | Situação |
|---|---|
| Multi-tenant + login com perfis (CEO, RT, Consultor multi-fábrica, Operador, Auditor somente leitura) | ✅ |
| Cadastros: fornecedores com qualificação (POP 01), matérias-primas, produtos e fórmulas (% ou kg/batelada) | ✅ |
| Aprovação e assinatura da fórmula pelo RT (alterar fórmula aprovada gera nova versão e bloqueia a produção) | ✅ |
| **RQ 1.2 Recebimento de Carga** mobile em 4 etapas, lote interno automático, checklist com bloqueio de NC, até 5 fotos, assinatura por senha, PDF | ✅ |
| Quarentena automática de carga não conforme + decisão assinada do RT | ✅ |
| Produção / sequenciamento (POP 07) com consumo de lotes FEFO, controle de saldo e desvio de formulação | ✅ |
| Expedição e rastreabilidade bidirecional (para trás e recall para frente) | ✅ |
| Trilha de auditoria imutável (trigger no PostgreSQL) | ✅ |
| Painel de gestão à vista (conformidade, quarentena, produção, NC por fornecedor) | ✅ |
| 9 POPs e RQs padrão pré-cadastrados (definição dos campos em JSON) | ✅ (execução na Fase 2) |
| PWA instalável, cache offline das telas e rascunho do RQ no aparelho | ✅ (assinatura exige rede) |
| Espelho do rótulo a partir da fórmula | ✅ prévia (ZPL na Fase 3) |

## Stack

Next.js 15 (App Router, Server Actions) · React 19 · Tailwind CSS 4 · PostgreSQL 16 · Prisma 6 ·
PDFKit (PDF dos RQs) · jose (sessão JWT em cookie httpOnly) · bcrypt · Vitest.

## Rodando localmente

```bash
cp .env.example .env              # ajuste DATABASE_URL e AUTH_SECRET
docker compose up -d              # PostgreSQL 16 (ou use um Postgres existente)
npm install
npx prisma migrate deploy         # cria tabelas e triggers de imutabilidade
npm run db:seed                   # 9 POPs + 2 fábricas de demonstração
npm run dev                       # http://localhost:3000
```

Usuários de demonstração (senha `nutripec123`):

| E-mail | Perfil |
|---|---|
| rt@nutripec.demo | Responsável Técnico |
| operador@nutripec.demo | Operador de chão de fábrica |
| ceo@nutripec.demo | CEO / proprietário |
| consultor@nutripec.demo | Consultor de BPF (acessa 2 fábricas) |
| auditor@nutripec.demo | Auditor fiscal (somente leitura) |

Testes: `npm test` (regras puras + integração contra o banco do `DATABASE_URL`).

## Decisões de arquitetura

- **Multi-tenant por coluna `tenant_id`**: todo acesso passa por `exigirCtx()` (`src/lib/auth.ts`), que relê o vínculo
  usuário×empresa no banco a cada requisição, então revogar um acesso vale na hora. O consultor tem um vínculo por fábrica.
- **Regras de negócio em `src/lib/servicos/`**, independentes da interface: as Server Actions só autenticam, validam a senha
  e chamam o serviço. Os mesmos serviços são usados pelo seed e pelos testes.
- **Assinatura eletrônica**: o usuário redigita a senha (validada com bcrypt no servidor); o conteúdo assinado (cabeçalho,
  respostas, hash de cada foto, assinante, data/hora do servidor) é serializado em JSON canônico e recebe um **SHA-256**
  gravado no registro e impresso no PDF. Tentativas com senha errada também vão para a auditoria.
- **Imutabilidade no banco, não só na aplicação**: triggers bloqueiam `UPDATE/DELETE` em `audit_logs`, em fotos, em
  consumos de lote e nos campos assinados de `rq_execucoes` (ver `prisma/migrations/*_init/migration.sql`).
- **Auditoria transacional**: `criarAuditado/atualizarAuditado` (`src/lib/audit.ts`) gravam valor anterior e novo na mesma
  transação da alteração.
- **Motor de formulários**: os campos de cada RQ ficam em `rq_modelos.campos` (JSONB) e são avaliados por
  `src/lib/rq/campos.ts` (conformidade, numérico com faixa, texto; NC exige descrição + ação corretiva). É a base do
  customizador da Fase 2.
- **Lote interno configurável** por empresa (`{PREFIXO}-{DDMMAAAA}` → `BIC-03102026`; repetição no dia recebe `-2`),
  sempre no fuso de Brasília.
- **PDF gerado sob demanda** a partir do registro imutável (PDFKit, sem Chromium no servidor). Cada emissão é auditada.
- **Arquivos**: `src/lib/storage.ts` grava em disco; trocar por S3/GCS é mudar só esse arquivo.

## Próximos passos (Fase 2)

- Execução dos demais RQs com o mesmo motor (`Checklist` já é genérico) e agenda diária/semanal/atrasados.
- Customizador de formulários para o RT.
- Alertas de pendências por e-mail/WhatsApp e tratamento de NC com ação preventiva.
- Fila offline com assinatura posterior (decidir modelo jurídico: PIN do aparelho ou reassinatura online).
