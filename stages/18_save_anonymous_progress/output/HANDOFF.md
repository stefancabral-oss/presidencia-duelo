# HANDOFF — ICM 18

Estado: implementação pronta para revisão técnica; issue aberta até aceite humano com conta Google real.

Issue: https://github.com/stefancabral-oss/presidencia-duelo/issues/234
PR: https://github.com/stefancabral-oss/presidencia-duelo/pull/235

## Entrega

- O login em uma conta existente reúne escolhas anônimas confirmadas ao ranking pessoal sem reescrever `votes`, `choice_rounds` ou cortes públicos. Placar derivado, quotas e inventário são consolidados em transação.
- `player_history_links` registra a fonte original e a chave apresentada como hash. A credencial anônima é revogada. Um retry da mesma credencial devolve a conta sem repetir a incorporação.
- Se as duas partidas responderam à mesma edição diária, a sessão anônima recente continua ativa. As duas séries de respostas continuam armazenadas; resultados fechados mostram a partida anterior separadamente.
- Sessões Google já abertas em outros aparelhos permanecem válidas quando muda o jogador ativo. Uma trava transacional por jogador impede que um voto em voo atravesse a incorporação.
- A interface informa quantas escolhas foram incorporadas e qual sessão diária ficou ativa.

## Evidência

- `back/scripts/topic-store-smoke.mjs` exercita conflito diário, retry, outra sessão Google, incorporação posterior no modo livre, revogação da origem, preservação de respostas e ausência de votos públicos extras. O job `back-integration-postgres` passou no CI para `34032d6`.
- `back-unit`, `shared-data` e `Design Validator` passaram no mesmo commit.
- Localmente, 167 testes do app, 51 testes focados de backend e build do app passaram.
- O suite completo de backend no Windows ficou limitado por Python local indisponível e fixture documental externa; o `back-unit` do CI passou.

## Gate restante

Stefan deve testar em ambiente publicado com sua própria conta: entrar, sair, fazer uma escolha anônima, entrar de novo, conferir ranking e rodada do dia, e repetir o login. Essa prova de produto não é substituída pelo Google simulado do navegador nem pelo CI. Após o aceite, mesclar a PR e fechar #234. Não fazer deploy automático nem fechar a issue antes desse gate.
