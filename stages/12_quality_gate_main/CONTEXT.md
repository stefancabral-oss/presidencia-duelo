# [ICM 12] Portão de qualidade da `main`

## Objetivo

Fazer cada mudança chegar à `main` com evidência automática da camada que ela altera, sem misturar unidades independentes.

## Macro e unidade ativa

- Macro: [#175 — Portão de qualidade para main](https://github.com/stefancabral-oss/presidencia-duelo/issues/175).
- Unidades concluídas: `U01`, [#174 — cobertura de CI para `back/` e `shared/`](https://github.com/stefancabral-oss/presidencia-duelo/issues/174), integrada pela PR #185; `U02`, [#165 — hierarquia de informação da carta](https://github.com/stefancabral-oss/presidencia-duelo/issues/165), integrada pela PR #186; e `U03`, [#168 — sistema responsivo por comportamento](https://github.com/stefancabral-oss/presidencia-duelo/issues/168), integrada pela PR #187.
- Unidade ativa: `U04`, [#169 — feedback da rodada pessoal](https://github.com/stefancabral-oss/presidencia-duelo/issues/169).
- Próxima unidade: [#170 — limite, identificação e CORS do voto público](https://github.com/stefancabral-oss/presidencia-duelo/issues/170), somente depois do gate de U04.

## Escopo de U04

- separar o feedback primário do jogador do evento secundário do placar público;
- calcular a ordem pessoal pela maioria das comparações diretas observadas, com ciclos e relações ainda não resolvidas empatados de forma honesta;
- manter Elo, vitórias e derrotas visíveis como contexto, sem usá-los para inventar preferência;
- preservar a recuperação idempotente de rodadas novas e antigas sem rotular feedback global legado como pessoal;
- manter a ordem acessível `No seu ranking` antes de `No placar do público`;
- reproduzir em teste o caso medido de 35 rodadas e versionar evidência visual dos dois canais.

## Exclusões de U04

- não implementar rate limit, identificação pública ou política de CORS da #170;
- não alterar a hierarquia interna da carta aprovada na #165;
- não alterar a matriz responsiva aprovada na #168, além do ajuste local necessário para o feedback transitório caber;
- não alterar catálogo, autenticação, áudio ou deploy fora do contrato do feedback;
- não misturar qualquer outra issue do portão de qualidade.

## Dependência resolvida

U03 foi integrada à `main` como `86d2659`. U04 nasceu diretamente desse commit, em branch e worktree próprios.

## Critérios de aceite

- resposta da rodada contém `personalFeedback` obrigatório e `globalEvent` opcional;
- interface apresenta primeiro `No seu ranking` e, quando relevante, depois `No placar do público`;
- ranking pessoal declara a política `pairwise-majority-scc-v1` e explica os empates;
- ciclos e comparações desconectadas compartilham posição, sem desempate por Elo, exposição ou ID;
- o caso de 35 rodadas é reproduzido por teste automatizado;
- replay legado retorna feedback pessoal neutro e preserva o antigo fato público no canal secundário;
- testes de back/app, build, smoke de interação e recuperação passam em Chromium e WebKit.

## Human gate

Stefan autorizou a integração automática das unidades que estiverem isoladas, revisadas, testadas e com CI verde. Essa autorização não substitui os gates técnicos nem permite empilhar #170 nesta PR.
