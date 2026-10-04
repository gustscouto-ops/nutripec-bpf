# NutriPEC Gestão BPF

SaaS de Gestão da Qualidade e Boas Práticas de Fabricação para fábricas de ração e suplementos,
ancorado na **IN MAPA nº 04/2007**. Este repositório contém as **Fases 1 (MVP) e 2 (motor completo dos 9 POPs)** do roadmap.

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
| 9 POPs e RQs padrão pré-cadastrados (definição dos campos em JSON) | ✅ |
| PWA instalável, cache offline das telas e rascunho do RQ no aparelho | ✅ (assinatura exige rede) |
| Espelho do rótulo a partir da fórmula | ✅ prévia (ZPL na Fase 3) |

## Stack

Next.js 15 (App Router, Server Actions) · React 19 · Tailwind CSS 4 · PostgreSQL 16 · Prisma 6 ·
PDFKit (PDF dos RQs) · jose (sessão JWT em cookie httpOnly) · bcrypt · Vitest.

## O que a Fase 2 entrega

| Módulo | Situação |
|---|---|
| Execução de **todos os RQs dos 9 POPs** com o mesmo checklist, fotos, rascunho no aparelho, assinatura e PDF | ✅ |
| **Tarefas do dia**: agenda calculada pela frequência (diária, semanal com dia de prazo, quinzenal, mensal com dia de prazo, semestral, anual), pendentes, atrasados e "quando ocorre" | ✅ |
| Registro fora do prazo marcado como atrasado (tela, histórico e PDF); um registro por período | ✅ |
| **Não conformidades**: abertas automaticamente por item NC de qualquer RQ (inclusive RQ 1.2, com fornecedor e lote) ou manualmente (reclamação, auditoria, fiscalização); ciclo ação imediata → causa raiz e ação preventiva com prazo → execução → verificação de eficácia assinada pelo RT; ineficaz volta ao tratamento; NC encerrada é imutável no banco | ✅ |
| **Customizador de formulários** (RT/Consultor): título, frequência, prazo, itens (conformidade, medição com faixa, texto), ordem, obrigatoriedade, ativar/desativar, criar RQ novo. O padrão do sistema nunca é alterado: a empresa ganha versão própria, cada mudança de itens sobe a versão e registros assinados guardam a cópia dos campos da época | ✅ |
| **Instruções de Trabalho (ITs)** por POP: visão do operador (passos grandes e alertas de segurança), impressão e edição com versão da empresa; links a partir do RQ | ✅ |
| Painel do RT: RQs atrasados e pendentes, NCs abertas e vencidas, conformidade por POP (30 dias) | ✅ |
| **Alertas diários** por e-mail (SMTP) e WhatsApp (gateway HTTP), destinatários por usuário, envio de teste e histórico | ✅ |

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

Testes: `npm test` (regras puras, agenda e integração contra o banco do `DATABASE_URL`; 50 testes).

### Alertas (opcional)

Sem configuração, os envios ficam registrados como "simulados" em Configurações. Variáveis:

| Variável | Uso |
|---|---|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | envio de e-mail |
| `WHATSAPP_API_URL`, `WHATSAPP_API_TOKEN` | gateway que recebe `POST {"to","message"}` (Z-API, Twilio via proxy, Meta Cloud API via adaptador) |
| `CRON_SECRET` | protege `GET /api/cron/alertas` (cabeçalho `Authorization: Bearer <segredo>`) |
| `APP_URL` | endereço público usado nos links das mensagens |

Agende uma chamada diária, por exemplo às 7h: `curl -H "Authorization: Bearer $CRON_SECRET" https://seu-dominio/api/cron/alertas`.
O sistema envia no máximo um resumo por dia para cada destinatário.

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
- **Agenda sem tabela de tarefas** (`src/lib/agenda.ts`, `tarefas()` em `src/lib/servicos/rq.ts`): os períodos são
  calculados a partir da frequência do modelo vigente e cruzados com os registros (`referencia_inicio`). Mudar a
  frequência vale na hora, sem migrar tarefas. Atrasos são cobrados por até 7 dias (diários), 2 semanas (semanais) ou
  1 período (demais), e nunca antes da data de cadastro da empresa.
- **Modelos globais × da empresa**: `rq_modelos` e `instrucoes_trabalho` com `tenant_id` nulo são o padrão; a primeira
  personalização cria a cópia da empresa (`origem_id`). Índices únicos parciais garantem um padrão e uma cópia por código.
- **Numeração** por empresa e código de RQ (e das NCs) com `pg_advisory_xact_lock`, sem buracos nem duplicidade.
- **Arquivos**: `src/lib/storage.ts` grava em disco; trocar por S3/GCS é mudar só esse arquivo.

## Próximos passos (Fase 3)

- Etiquetas ZPL e rotulagem completa a partir da fórmula aprovada.
- Fila offline com assinatura posterior (decidir modelo jurídico: PIN do aparelho ou reassinatura online).
- Anexos em NCs e ITs (fotos por passo), auditoria interna com checklist da IN 04/2007 e relatório para fiscalização.
- Cobrança/assinatura do SaaS por fábrica.
