# B01 — implementação de contratos e schema

Issue [#210](https://github.com/stefancabral-oss/presidencia-duelo/issues/210), branch `feat/210-civic-contracts`, base main `f99ac18` com planejamento #228 incorporado por merge. Responsável pela implementação: Codex, sob autorização de Stefan para construir as pendências.

Entregue: 17 schemas compartilhados, validadores estritos, fixtures sintéticas, leitura alfabética paginada, comparação por recorte, estados de publicação/cobertura, histórico, migração isolada `civic_v1`, rollback vazio e ensaio PostgreSQL no workflow existente. [Contrato e arquitetura](../back/B01-contract.md) detalham interfaces para Front/App e responsabilidades futuras.

PR [#230](https://github.com/stefancabral-oss/presidencia-duelo/pull/230), commit de implementação `06dac872ec3af4e879236dd9b7710e57b5947086`.

Validação local: 354 testes aprovados, incluindo 23 novos testes de contrato; build Vite aprovado e `git diff --check` sem erros. Backend/Shared e Design aprovados no CI. PostgreSQL 16 aprovou migração, idempotência, rollback vazio, recusa de rollback populado, sete verificações relacionais e fingerprint inalterado de todos os dados em `public`. Resultados e links em [B01-verification.json](B01-verification.json). Browsers ainda rodavam ao registrar este arquivo; o resultado final consta nos checks e descrição da PR. Este registro posterior altera apenas documentação.

Limites: não há importador oficial, API HTTP, telas, autorização editorial, cache de notícias ou deploy nesta unidade. Fixtures não equivalem a dados aprovados. Os validadores precisam integrar as transações de escrita das próximas unidades; as constraints SQL não cobrem sozinhas todas as regras semânticas. Histórico guarda snapshots/auditoria sem autorizar publicação por conta própria.

Checks finais do head publicado: aprovados. Pendente: publicar e validar as correções abaixo, revisão de contratos por consumidores, aceite humano de terminologia/entidades e estratégia de migração. #210 permanece aberta. Próximas unidades técnicas B02/B04 e protótipos Front/App podem usar o contrato preliminar, respeitando o gate para conclusão.

## Revisão adicional — sete correções locais ainda não publicadas

O CI final do commit publicado `181ea41777bce51adfd6f6e1631d46de3c45d3bc` passou em Backend/Shared, PostgreSQL, Design e Chromium/WebKit. Os seis comentários de revisão da PR e o achado independente de unicidade lógica foram implementados localmente: preservação dos integrantes das chapas, ciclos combinados de tradução/republicação, eventos publicados nas edições públicas, coerência das ações de auditoria com snapshots/transições, evidência nula em cobertura sem resultado, orientação `center` e unicidade lógica de recortes/edições/auditoria.

Os 44 cenários de `shared/civic-review-scenarios.js` passaram por chamada direta contra os módulos reais salvos; o mesmo conjunto foi registrado no arquivo `node:test`, preservando os 23 testes publicados anteriores. Incluem estados e transições válidos/inválidos, snapshots reordenados, cobertura e edição, e uma cadeia de 4.002 matérias sem recursão. A sintaxe de cinco arquivos JS foi analisada pelo parser instalado. A revisão independente dos novos blocos não encontrou bloqueadores.

O smoke PostgreSQL passou a verificar 19 escritas rejeitadas, formação transacional de chapa parcial e UPDATE sem mudança real. Sua execução ainda está pendente; análise estrutural SQL não substitui essa verificação. Os 354 testes, build e fingerprint PostgreSQL anteriores referem-se aos commits publicados, não às correções atuais. Não registrar a suíte completa ou CI das correções como aprovados.

Commit, push, suíte completa, build e novo CI continuam pendentes. A execução de processos falhou com `windows unelevated restricted-token sandbox cannot enforce split writable root sets directly; refusing to run unsandboxed`; escritas GitHub exigem aprovação mas a política da sessão é `never`. As edições usam somente acesso a arquivos no workspace autorizado. Pacote atualizado de retomada: `b01-complete-review.patch` no diretório work, fora do repositório; preserva separação da correção documental preparada para #228. Como a migração v1 ainda não foi mesclada/aplicada a um banco real, o SQL inicial foi corrigido antes da entrega; bancos de ensaio com checksum anterior precisam de novo namespace descartável, sem sobrescrever dados existentes.

#210 permanece aberta para revisão dos consumidores e seu gate humano; nenhum merge, encerramento ou deploy foi executado por estas correções.

## Retomada com execução liberada

Em 2026-09-18T00:44:57.861Z, a suíte completa das correções passou: 398 testes, zero falhas. Build Vite e `git diff --check` aprovados. O bloqueio anterior de processos foi superado. A execução PostgreSQL 16 e a publicação/CI serão confirmadas na PR; não inferir aprovação do banco a partir destes testes locais.
