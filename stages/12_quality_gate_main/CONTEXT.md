# [ICM 12] Portão de qualidade da `main`

## Objetivo

Fazer cada mudança chegar à `main` com evidência automática da camada que ela altera, sem misturar backend, dados compartilhados e navegador no mesmo check.

## Macro e unidade ativa

- Macro: [#175 — Portão de qualidade para main](https://github.com/stefancabral-oss/presidencia-duelo/issues/175).
- Unidade ativa: `U01`, [#174 — cobertura de CI para `back/` e `shared/`](https://github.com/stefancabral-oss/presidencia-duelo/issues/174).
- Ordem posterior: `#165/#168`, `#169`, `#173/#176`, `#166/#167`, `#171/#170` e `#172`.

## Escopo de U01

- criar checks independentes para unidade do backend, domínio compartilhado e integração PostgreSQL;
- remover testes que inspecionam texto do fonte em vez de comportamento;
- retirar o caminho inexistente `front/**` dos workflows;
- entender e registrar por que a PR #162 não disparou CI automaticamente;
- produzir evidência de execução automática no evento `pull_request`.

## Exclusões de U01

- nenhuma mudança visual ou de produto;
- nenhum teste de backend dentro da matriz de navegadores;
- nenhuma alteração, rebase ou resolução de conflito na PR #162;
- nenhuma mudança nas issues #165–#173 ou #176.

## Dependência resolvida sem sobreposição

A PR #162 foi integrada em `main` pelo commit `6eed68a`. U01 atualizou sua base somente depois desse gate e removeu `front/**` de `.github/workflows/ui-interaction-smoke.yml`, preservando `app/**`, `shared/**` e o smoke de recuperação de voto trazido pela #162.

## Critérios de aceite

- os jobs `back-unit`, `shared-data` e `back-integration-postgres` passam em execução automática de PR;
- a integração usa um PostgreSQL de serviço isolado;
- nenhum teste remanescente lê `topic-store.js` ou `server.js` para procurar strings;
- `front/**` não existe nos filtros após a dependência #162 ser resolvida;
- a causa do não-disparo de #162 permanece auditável;
- HANDOFF e `verification.json` refletem resultados reais, sem promover run manual a prova de gatilho.

## Human gate

O estágio só avança quando Stefan Cabral revisar a PR, os checks automáticos e a ausência de mistura com #162.
