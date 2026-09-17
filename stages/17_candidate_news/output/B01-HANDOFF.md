# B01 — implementação de contratos e schema

Issue [#210](https://github.com/stefancabral-oss/presidencia-duelo/issues/210), branch `feat/210-civic-contracts`, base main `f99ac18` com planejamento #228 incorporado por merge. Responsável pela implementação: Codex, sob autorização de Stefan para construir as pendências.

Entregue: 17 schemas compartilhados, validadores estritos, fixtures sintéticas, leitura alfabética paginada, comparação por recorte, estados de publicação/cobertura, histórico, migração isolada `civic_v1`, rollback vazio e ensaio PostgreSQL no workflow existente. [Contrato e arquitetura](../back/B01-contract.md) detalham interfaces para Front/App e responsabilidades futuras.

PR [#230](https://github.com/stefancabral-oss/presidencia-duelo/pull/230), commit de implementação `06dac872ec3af4e879236dd9b7710e57b5947086`.

Validação local: 354 testes aprovados, incluindo 23 novos testes de contrato; build Vite aprovado e `git diff --check` sem erros. Backend/Shared e Design aprovados no CI. PostgreSQL 16 aprovou migração, idempotência, rollback vazio, recusa de rollback populado, sete verificações relacionais e fingerprint inalterado de todos os dados em `public`. Resultados e links em [B01-verification.json](B01-verification.json). Browsers ainda rodavam ao registrar este arquivo; o resultado final consta nos checks e descrição da PR. Este registro posterior altera apenas documentação.

Limites: não há importador oficial, API HTTP, telas, autorização editorial, cache de notícias ou deploy nesta unidade. Fixtures não equivalem a dados aprovados. Os validadores precisam integrar as transações de escrita das próximas unidades; as constraints SQL não cobrem sozinhas todas as regras semânticas. Histórico guarda snapshots/auditoria sem autorizar publicação por conta própria.

Pendente: conclusão dos checks de navegador na PR, revisão de contratos por consumidores, aceite humano de terminologia/entidades e estratégia de migração. #210 permanece aberta. Próximas unidades técnicas B02/B04 e protótipos Front/App podem usar o contrato preliminar, respeitando o gate para conclusão.
