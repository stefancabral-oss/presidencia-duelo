# HANDOFF — ICM 12 · U01

## Status

- Estado: `validação local final aprovada; CI final e gate humano pendentes`
- Issue: https://github.com/stefancabral-oss/presidencia-duelo/issues/174
- Macro: https://github.com/stefancabral-oss/presidencia-duelo/issues/175
- Branch: `icm/12-u01-ci-back-shared-174`
- PR: https://github.com/stefancabral-oss/presidencia-duelo/pull/185
- Commit da implementação: `c0911e2`
- Base integrada: `main@6eed68a` (merge aprovado da PR #162)

## Entregue

- Workflow próprio para unidade do backend, domínio compartilhado e integração PostgreSQL.
- Testes comportamentais diretos da matemática Elo compartilhada.
- Remoção dos cinco testes que faziam `readFile` e regex sobre o próprio fonte.
- Remoção de `front/**` do Design Validator.
- Remoção de `front/**` do UI Interaction Smoke, preservando `app/**`, `shared/**` e o E2E de recuperação.
- Diagnóstico auditável do não-disparo automático da PR #162.

## Não entregue / pendente

- Reexecução automática dos checks no head final atualizado sobre `main@6eed68a`.
- Revisão humana da PR #185.

## Testes executados

- `npm run test:shared`: 4/4 aprovados.
- `npm test --prefix back`: 17/17 aprovados.
- `npm test --prefix app`: 46/46 aprovados.
- `npm test`: 67/67 aprovados no encadeamento completo.
- `npm run build --prefix app`: aprovado; 99/125 retratos disponíveis e bundle de produção gerado.
- `actionlint` 1.7.12: `back-shared.yml`, `design-validator.yml` e `ui-interaction-smoke.yml` passaram sem findings.
- GitHub Actions no evento `pull_request`, antes da atualização final da base: `back-unit`, `shared-data`, `back-integration-postgres` e `validate` aprovados.
- PostgreSQL 16 de serviço: integração aprovada no run automático [35048640056](https://github.com/stefancabral-oss/presidencia-duelo/actions/runs/35048640056).
- PR #162 após resolver o conflito: Design Validator [35051211773](https://github.com/stefancabral-oss/presidencia-duelo/actions/runs/35051211773) e UI Interaction Smoke [35051211779](https://github.com/stefancabral-oss/presidencia-duelo/actions/runs/35051211779) dispararam automaticamente e passaram.

## Riscos conhecidos

- A integração PostgreSQL depende do serviço isolado do GitHub Actions; não havia PostgreSQL local nesta estação para repetir esse job.
- `npm ci --prefix app` reporta uma vulnerabilidade alta já presente nas dependências; atualização de dependência não foi misturada nesta unidade de CI.

## Decisões tomadas

- Não empilhar U01 sobre a branch da PR #162.
- Atualizar a base somente após o gate e o merge da PR #162.
- Preservar integralmente `shared/**` e o E2E de recuperação ao retirar o caminho morto `front/**`.
- Não rodar backend dentro da matriz de navegadores.
- Não criar arquitetura nova apenas para preservar testes que inspecionavam strings do fonte.
- Usar a causa comprovada do conflito de merge, em vez de alterar proteção da `main` antes de existirem checks reais.

## Próximo passo exato

1. Publicar o head atualizado da PR #185 e confirmar os checks automáticos finais.
2. Stefan revisar a separação dos workflows e conceder ou negar o gate humano.

## Human gate

- Decisão: `pendente`
- Responsável: Stefan Cabral
- Observação: revisar a separação de responsabilidades e a remoção final do caminho morto sem perda dos smokes da #162.
