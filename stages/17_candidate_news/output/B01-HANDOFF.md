# B01 — implementação de contratos e schema

Issue [#210](https://github.com/stefancabral-oss/presidencia-duelo/issues/210), branch `feat/210-civic-contracts`, base main `f99ac18` com planejamento #228 incorporado por merge. Responsável pela implementação: Codex, sob autorização de Stefan para construir as pendências.

Entregue: 17 schemas compartilhados, validadores estritos, fixtures sintéticas, leitura alfabética paginada, comparação por recorte, estados de publicação/cobertura, histórico, migração isolada `civic_v1`, rollback vazio e ensaio PostgreSQL no workflow existente. [Contrato e arquitetura](../back/B01-contract.md) detalham interfaces para Front/App e responsabilidades futuras.

Validação local: 354 testes aprovados, incluindo 23 novos testes de contrato; build Vite aprovado e `git diff --check` sem erros. Ensaio PostgreSQL e browsers será verificado na PR; não há PostgreSQL instalado neste ambiente local. Resultados em [B01-verification.json](B01-verification.json).

Limites: não há importador oficial, API HTTP, telas, autorização editorial, cache de notícias ou deploy nesta unidade. Fixtures não equivalem a dados aprovados. Os validadores precisam integrar as transações de escrita das próximas unidades; as constraints SQL não cobrem sozinhas todas as regras semânticas. Histórico guarda snapshots/auditoria sem autorizar publicação por conta própria.

Pendente: CI remoto, revisão de contratos por consumidores, aceite humano de terminologia/entidades e estratégia de migração. #210 permanece aberta. Próximas unidades técnicas B02/B04 e protótipos Front/App podem usar o contrato preliminar, respeitando o gate para conclusão.
