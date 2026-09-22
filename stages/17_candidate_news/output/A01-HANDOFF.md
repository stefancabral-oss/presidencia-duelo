# A01 — handoff do shell, rotas e contrato de montagem

Issue [#223](https://github.com/stefancabral-oss/presidencia-duelo/issues/223), branch `claude/open-issues-check-0y643o` sobre `main` `0200a05` (B01 #210 concluída; B02 #211 e B04 #213 mescladas em 21/09/2026). Stefan autorizou iniciar A01 em paralelo com F01 (#217) e A02 (#224) em 21/09/2026. Commit de implementação `03d9fe3` (árvore completa das três unidades). PR e número ficam registrados na issue e na descrição da PR.

## Entrega técnica

- Rotas por hash para diretório, ficha, comparação, edição do dia, edição e acontecimento, com limites de parâmetros, avisos para parâmetros ignorados e estado legível para destino inexistente. Decisão hash × caminho documentada no [contrato](../app/A01-contract.md): o build usa `base: "./"`, então caminhos aninhados quebrariam a recarga.
- Flags separadas (`civicDirectory`, `civicNews`) vindas de `/api/game-capabilities` ou de variáveis de build. Com as duas desligadas, a barra atual permanece intacta e um deep link mostra "Esta área ainda não está aberta".
- Proposta `Início · Jogar · Candidatos · Notícias · Mais`, com Ranking e Coleção dentro de `Mais` (mesmos botões do jogo, movidos de lugar). Hipótese a validar; reversível por flag.
- Contrato de montagem FRONT ⇄ APP (`createScreen` → `mount/update/unmount/focusInitial`, `ctx.actions`, `view`), com foco no título ao entrar, retorno ao acionador ao sair, título do documento por rota e rolagem restaurada em voltar/avançar. Entrar numa rota sempre revalida com o servidor.
- Integração em `app/src/main.js` por seis hooks explícitos; o motor de votação não foi editado. Adicionado `app/e2e/civic-navigation.mjs` ao `ui-interaction-smoke.yml`.

## Evidências e limites

- Unitários: 198 aprovados (`npm test --prefix app`), incluindo `civic-router.test.js` e `civic-flags.test.js`. Build aprovado; `git diff --check` limpo.
- E2E local em Chromium: 13/13 cenários ([resultado](A01-e2e-results.json)), entre eles deep link recarregado, voltar/avançar com filtros, saída para a ficha durante a rodada e retorno com as mesmas quatro cartas, nenhum `roundId` novo e zero requisições de voto, foco devolvido ao acionador, Ranking alcançável por `Mais`, retirada, limite e corrida de UF.
- Regressão local em Chromium: os 13 scripts E2E existentes do workflow passaram com o shell integrado (flags desligadas nesses cenários). Coleção segue `gameFeatures.collection`, como antes.
- Limites: WebKit só será exercitado no CI da PR; zoom e leitores de tela não foram medidos; a entrada por vínculo pessoa → candidatura a partir do perfil do jogo depende de B06 e não foi implementada; cache, flags operacionais e isolamento do PWA pertencem a A03.

## Revisão humana

Stefan (responsável de produto) aprovou este gate em 22/09/2026, autorizando o merge da cadeia #237→#238→#233. #223 permanece aberta até seu próprio critério de conclusão; a aprovação do gate não fecha a issue. Detalhes em [A01-verification.json](A01-verification.json).

## Reversão

Desligar as flags no servidor restaura a barra atual sem deploy de código. Reverter o commit remove o shell e os hooks; não há alteração de banco, service worker, manifest ou deploy.

## CI da árvore completa

Head documental `ccb74d5`: UI Interaction Smoke aprovado em Chromium e WebKit (inclui `civic-navigation.mjs`), Design Validator e Civic Planning aprovados. Backend/Shared não dispara porque a PR não altera `back/` nem `shared/`. Registro posterior só de evidência; nenhum gate humano foi aprovado.

## Divisão em PR própria — 22/09/2026

A pedido de Stefan, a PR única #233 foi dividida em três PRs empilhadas por unidade. A PR #233 foi reaproveitada para esta unidade (A01): base atualizada de `main` para a branch de F01, mostrando só o diff de A01 e da documentação (`03d9fe3`, `ccb74d5`, `d5083bb`). É a última da cadeia e a única que fecha a árvore completa e passa CI verde, porque A01 integra F01 ([PR #238](https://github.com/stefancabral-oss/presidencia-duelo/pull/238)) e A02 ([PR #237](https://github.com/stefancabral-oss/presidencia-duelo/pull/237)). Ordem de merge: #237 → #238 → #233. Nenhum código foi alterado nesta divisão, só a estrutura de PRs.
