# HANDOFF — ICM 12 · U01

## Status

- Estado: `em andamento`
- Issue: https://github.com/stefancabral-oss/presidencia-duelo/issues/174
- Macro: https://github.com/stefancabral-oss/presidencia-duelo/issues/175
- Branch: `icm/12-u01-ci-back-shared-174`
- PR: `pendente`
- Commit da implementação: `c0911e2`

## Entregue

- Workflow próprio para unidade do backend, domínio compartilhado e integração PostgreSQL.
- Testes comportamentais diretos da matemática Elo compartilhada.
- Remoção dos cinco testes que faziam `readFile` e regex sobre o próprio fonte.
- Remoção de `front/**` do Design Validator.
- Diagnóstico auditável do não-disparo automático da PR #162.

## Não entregue / pendente

- Remover `front/**` de `.github/workflows/ui-interaction-smoke.yml` depois que a PR #162 for resolvida, sem perder `shared/**` nem o E2E de recuperação.
- Registrar os IDs das execuções automáticas desta PR.
- Atualizar este HANDOFF com PR, commit final e resultados.

## Testes executados

- `npm run test:shared`: 4/4 aprovados.
- `npm test --prefix back`: 17/17 aprovados.
- `npm test --prefix app`: 41/41 aprovados.
- `npm test`: 62/62 aprovados no encadeamento completo.
- `npm run build --prefix app`: aprovado; 99/125 retratos disponíveis e bundle de produção gerado.
- `actionlint` 1.7.12: os workflows novo e alterado passaram sem findings.
- Integração PostgreSQL local: não executada porque a máquina não possui PostgreSQL nem Docker; deve passar no serviço real do GitHub Actions antes do gate.

## Riscos conhecidos

- Alterar agora o workflow de UI produziria sobreposição direta com a PR #162.
- Runs manuais não demonstram que o gatilho `pull_request` funciona.

## Decisões tomadas

- Não empilhar U01 sobre a branch da PR #162.
- Não rodar backend dentro da matriz de navegadores.
- Não criar arquitetura nova apenas para preservar testes que inspecionavam strings do fonte.
- Usar a causa comprovada do conflito de merge, em vez de alterar proteção da `main` antes de existirem checks reais.

## Próximo passo exato

1. Abrir a PR de U01 e observar os três checks, incluindo a integração PostgreSQL, no evento `pull_request`.

## Human gate

- Decisão: `pendente`
- Responsável: Stefan Cabral
- Observação: revisar a separação de responsabilidades e a pendência isolada da PR #162.
