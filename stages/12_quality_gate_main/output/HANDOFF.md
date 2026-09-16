# HANDOFF — ICM 12 · U01

## Status

- Estado: `CI aprovado; aguardando gate humano`
- Issue: https://github.com/stefancabral-oss/presidencia-duelo/issues/174
- Macro: https://github.com/stefancabral-oss/presidencia-duelo/issues/175
- Branch: `icm/12-u01-ci-back-shared-174`
- PR: https://github.com/stefancabral-oss/presidencia-duelo/pull/185
- Commit da implementação: `c0911e2`

## Entregue

- Workflow próprio para unidade do backend, domínio compartilhado e integração PostgreSQL.
- Testes comportamentais diretos da matemática Elo compartilhada.
- Remoção dos cinco testes que faziam `readFile` e regex sobre o próprio fonte.
- Remoção de `front/**` do Design Validator.
- Diagnóstico auditável do não-disparo automático da PR #162.

## Não entregue / pendente

- Remover `front/**` de `.github/workflows/ui-interaction-smoke.yml` depois que a PR #162 for resolvida, sem perder `shared/**` nem o E2E de recuperação.
- Revisão humana da PR #185.

## Testes executados

- `npm run test:shared`: 4/4 aprovados.
- `npm test --prefix back`: 17/17 aprovados.
- `npm test --prefix app`: 41/41 aprovados.
- `npm test`: 62/62 aprovados no encadeamento completo.
- `npm run build --prefix app`: aprovado; 99/125 retratos disponíveis e bundle de produção gerado.
- `actionlint` 1.7.12: os workflows novo e alterado passaram sem findings.
- GitHub Actions no evento `pull_request`: `back-unit`, `shared-data`, `back-integration-postgres` e `validate` aprovados.
- PostgreSQL 16 de serviço: integração aprovada no run automático [35048640056](https://github.com/stefancabral-oss/presidencia-duelo/actions/runs/35048640056).

## Riscos conhecidos

- Alterar agora o workflow de UI produziria sobreposição direta com a PR #162.
- Runs manuais não demonstram que o gatilho `pull_request` funciona.

## Decisões tomadas

- Não empilhar U01 sobre a branch da PR #162.
- Não rodar backend dentro da matriz de navegadores.
- Não criar arquitetura nova apenas para preservar testes que inspecionavam strings do fonte.
- Usar a causa comprovada do conflito de merge, em vez de alterar proteção da `main` antes de existirem checks reais.

## Próximo passo exato

1. Stefan revisar a PR #185 e o único item deliberadamente isolado: retirar `front/**` do workflow de UI depois que a PR #162 for resolvida.

## Human gate

- Decisão: `pendente`
- Responsável: Stefan Cabral
- Observação: revisar a separação de responsabilidades e a pendência isolada da PR #162.
