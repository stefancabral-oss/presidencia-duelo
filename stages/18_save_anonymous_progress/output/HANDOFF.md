# HANDOFF — ICM 18

Estado: implementação pronta para revisão técnica; issue aberta até aceite humano com conta Google real.

Issue: https://github.com/stefancabral-oss/presidencia-duelo/issues/234
PR: https://github.com/stefancabral-oss/presidencia-duelo/pull/235

## Entrega

- O login em uma conta existente reúne escolhas anônimas confirmadas ao ranking pessoal sem reescrever `votes`, `choice_rounds` ou cortes públicos. Placar derivado e inventário são consolidados em transação. As quotas consumidas permanecem com cada origem, para não bloquear os dez slots da sessão diária selecionada.
- `player_history_links` registra a fonte original e a chave apresentada como hash. A credencial anônima é revogada. Um retry da mesma credencial devolve a conta sem repetir a incorporação.
- Se as duas partidas responderam à mesma edição diária, a sessão anônima recente continua ativa e pode concluir seus slots. As duas séries de respostas continuam armazenadas; resultados fechados mostram a partida anterior separadamente, com ordinal validado pela PWA.
- As rodadas de aquecimento concluídas nas duas origens contam uma vez no progresso pessoal. Uma emissão pendente com confronto antigo não substitui o confronto apropriado após a incorporação.
- Sessões Google já abertas em outros aparelhos permanecem válidas quando muda o jogador ativo. Uma trava transacional por jogador impede que um voto em voo atravesse a incorporação.
- A interface informa quantas escolhas foram incorporadas e qual sessão diária ficou ativa.

## Evidência

- `back/scripts/topic-store-smoke.mjs` exercita conflito diário com conta anterior 10/10 e sessão anônima que prossegue até 10/10, retry, outra sessão Google, incorporação posterior no modo livre, revogação da origem, preservação de respostas e ausência de votos públicos extras. `back/scripts/game-progress-smoke.mjs` cobre o aquecimento somado. A integração PostgreSQL passou no CI para `ed2900a`.
- `back-unit`, `shared-data` e `Design Validator` passaram no mesmo commit. Chromium e WebKit passaram em `f3f0f45`; o CI do head da PR valida também o novo aviso e o histórico duplicado no navegador.
- Localmente, 168 testes do app, 51 testes focados de backend e build do app passaram.
- O suite completo de backend no Windows ficou limitado por Python local indisponível e fixture documental externa; o `back-unit` do CI passou.

## Gate restante

Stefan deve testar em ambiente publicado com sua própria conta: entrar, sair, fazer uma escolha anônima, entrar de novo, conferir ranking e rodada do dia, e repetir o login. Essa prova de produto não é substituída pelo Google simulado do navegador nem pelo CI. Após o aceite, mesclar a PR e fechar #234. Não fazer deploy automático nem fechar a issue antes desse gate.
