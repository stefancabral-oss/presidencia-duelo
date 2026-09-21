# A01 — contrato de shell, rotas e montagem (#223)

Implementação de [A01](microissues/A01.md) sobre `main` `0200a05`, com B01 (#210) concluída e B02/B04 mescladas. Base confirmada: a consolidação #205 está em `main`; esta expansão tem branch/PR próprias (`claude/open-issues-check-0y643o`). O contrato descreve o que o código faz; gates humanos e deploy continuam pendentes, conforme [CONTEXT](../CONTEXT.md).

## Inventário do shell existente

- `app/src/main.js` compõe a tela: `state.screen` escolhe um painel persistente (`data-panel`) via `showPersistentPanel`; a barra `.bottom-nav` usa botões `data-screen`; o motor de votação (`state.round`, `roundId`, `pendingWinnerId`, `votePhase`) vive no painel `duel`, que permanece montado enquanto outras telas estão visíveis.
- Não existia roteamento por URL: nenhuma tela do jogo tem hash ou caminho próprio, e o histórico do navegador não era usado. Isso foi preservado: as telas do jogo continuam sem URL, para não mudar a semântica de Voltar dentro do duelo.
- Pontos compartilhados e dono nesta entrega: `app/src/main.js` e `.github/workflows/ui-interaction-smoke.yml` (APP, por hooks explícitos listados abaixo); `app/src/civic/ui/*` e `app/src/civic/ui/civic.css` (FRONT); `app/src/civic/{router,shell,flags,client,store,uf-preference,mock-transport}.js` (APP); `app/src/civic/view-models.js` (contrato FRONT ⇄ APP, coedição anunciada). `app/src/styles.css`, `app/public/sw.js`, `manifest.webmanifest` e `vite.config.js` não foram alterados.

## Decisão: rotas por hash

O build usa `base: "./"` (assets relativos). Um caminho aninhado como `/candidatos/x` faria `index.html` procurar `./assets/...` em `/candidatos/assets/...`; o `try_files` do nginx devolveria `index.html` no lugar do JavaScript e a recarga quebraria. O hash (`#/candidatos/...`) recarrega sempre `index.html`, funciona no `vite preview`, no nginx e em qualquer host estático, e mantém o jogo fora do histórico. Migrar para caminhos exige antes mudar `base` e revalidar o deploy; fica registrado para A03/A05.

Fallback de recarga testável: o E2E `app/e2e/civic-navigation.mjs` recarrega deep links válidos e inválidos.

| Rota | Tela | Parâmetros aceitos | Limites |
| --- | --- | --- | --- |
| `#/candidatos` | diretório | `disputa` (ID da disputa), `uf` (BR ou 27 UFs), `partido`, `situacao`, `busca` | textos ≤ 512 caracteres, sem caracteres de controle |
| `#/candidatos/comparar?ids=a,b[,c]` | comparação | `ids` | 2–3 IDs distintos; excedentes ignorados com aviso |
| `#/candidatos/:candidacyId` | ficha | `revisao` | ID B01 codificado com `encodeURIComponent` |
| `#/noticias` | edição do dia | `uf` | recorte inválido é descartado com aviso |
| `#/noticias/edicoes/:editionId` | edição | `revisao` | — |
| `#/noticias/acontecimentos/:eventId` | acontecimento | `revisao` | — |
| qualquer outro `#/...` | destino não encontrado | — | hash ≤ 4096 caracteres |

Parâmetros desconhecidos são descartados e listados como aviso na tela (`route.problems`); nenhum valor vira HTML, link aberto ou conteúdo executável (`app/src/civic/router.js`, testes em `app/src/civic-router.test.js`). Título do documento: `<Tela> · PoliMatch`; restaurado ao sair.

## Flags

`civicFlags(gameFeatures, env)` em `app/src/civic/flags.js`: `directory` liga com `civicDirectory: true` em `/api/game-capabilities` (versão 1) ou `VITE_CIVIC_DIRECTORY=1`; `news` com `civicNews: true` ou `VITE_CIVIC_NEWS=1`. Com as duas desligadas a barra continua exatamente `Início · Duelo · (Coleção) · Ranking` e um deep link cívico mostra "Esta área ainda não está aberta", sem quebrar o shell. Desligar uma área não toca na sessão do jogador. Operação e cache das flags pertencem a A03.

## Proposta de navegação (hipótese a validar)

Com qualquer área ligada, a barra passa a `Início · Jogar · Candidatos · Notícias · Mais`. `Mais` abre uma folha com `Ranking` e `Coleção` (os mesmos nós de botão do jogo, movidos de lugar; seus handlers continuam os de `main.js`). A folha fecha ao escolher, com Escape (foco volta a `Mais`) ou clique fora. Cinco botões evitam seis ou mais comprimidos; Ranking e Coleção continuam alcançáveis com um toque a mais. A organização depende da validação de produto prevista em F01/A01 e pode ser revertida desligando as flags.

## Contrato de montagem FRONT ⇄ APP

`createScreen(kind, ctx)` em `app/src/civic/ui/screens.js` devolve `{ kind, root, mount(container), update(view), unmount(), focusInitial() }`.

- `ctx = { store, flags(), actions, announce(message), now() }`. `actions`: `navigate(routeOuHref, { replace })`, `back()`, `retry(area)`, `applyFilters(params)`, `loadMore()`, `compare(ids)`, `setNewsJurisdiction(uf)`. Telas não chamam endpoints nem tocam em `location`/`history`.
- `view = { route, state, resolved, fromRoute }`: `route` vem do router; `state` é o snapshot do store (A02); `resolved` traz recorte e disputa efetivos; `fromRoute` marca atualização causada por mudança de URL, quando os filtros do formulário são sincronizados com o endereço mesmo com campo focado.
- Ciclo de vida: o shell mantém uma instância por tipo de tela, reaproveita `update` quando o tipo não muda e desmonta ao sair. Requisições em voo são canceladas por `AbortController` (`store.abort()`) ao sair da área.
- Foco: ao entrar numa rota nova, o foco vai ao `h1` da tela (`tabindex="-1"`); ao voltar ao jogo, volta ao acionador (botão da barra ou controle de origem) se ainda existir, senão ao botão ativo da barra. Rolagem: nova rota rola ao topo; voltar/avançar restaura a posição salva por URL.
- DOM: `app/src/civic/ui/dom.js` reconcilia listas por chave e só escreve texto (`textContent`); conteúdo externo nunca vira HTML; links externos só com HTTPS validado e `rel="noreferrer noopener"`.

## Preservação da rodada

Entrar e sair das áreas cívicas apenas altera `state.screen`; `state.round`, `roundId`, cartas, recibo e voto pendente não são lidos nem escritos pelo shell. "Voltar ao jogo" limpa o hash com `history.replaceState` (não empilha histórico) e devolve a tela anterior. Voltar/avançar do navegador percorre só as URLs cívicas; um hash vazio devolve ao jogo. O E2E confirma: os quatro `data-vote` permanecem iguais, nenhum `roundId` novo é gerado e nenhuma requisição de voto é enviada.

## Hooks em `app/src/main.js`

1. `import { createCivicShell } from "./civic/shell.js"`.
2. Painel `<main class="screen civic-screen" data-panel="civic" hidden>` e folha `#nav-more-sheet` no `appMarkup()`; botões `data-civic-area` e `data-nav-more` (ocultos) no `navMarkup()`.
3. `refs.civicPanel` e `refs.navMoreSheet` em `captureRefs()`.
4. `civicShell?.sync()` após `renderNavigation()` em `render()`.
5. `createCivicShell({...})` ao fim de `mountApp()`, com `getScreen/setScreen`, `getGameFeatures`, `isReady`, `announceStatus` e `sound`.
6. `civicShell?.start()` em `initialize()` após o jogo ficar pronto, para resolver deep links abertos antes da inicialização.

## Evidências desta unidade

- Unitários: `app/src/civic-router.test.js`, `app/src/civic-flags.test.js` (ordem e limites de rota, flags).
- E2E Chromium (`app/e2e/civic-navigation.mjs`, 13 cenários): flags desligadas; proposta de navegação com Ranking por `Mais`; deep link recarregado com foco no título; destino inexistente e parâmetros inválidos; filtros na URL com voltar/avançar; sair para a ficha durante a rodada e voltar sem voto, com foco de volta; voltar do navegador; comparação; retirada e limite; corrida de UF; notícias/acontecimento; teclado; desktop. Adicionado ao `ui-interaction-smoke.yml` para Chromium e WebKit.
- Pendente: validação de produto da organização de navegação e do retorno à rodada no protótipo integrado; WebKit só no CI.
