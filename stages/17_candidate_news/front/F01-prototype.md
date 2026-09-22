# F01 — protótipo, componentes e estados editoriais (#217)

Implementação de [F01](microissues/F01.md) dentro de `app/`, sobre as fixtures de [B01](../back/B01-contract.md) e os contratos de [A01](../app/A01-contract.md) e [A02](../app/A02-contract.md). Tudo aqui é protótipo com dados sintéticos identificados como tais; nenhuma tela foi validada por produto, editorial, pessoas usuárias ou revisão assistiva humana.

## Como abrir o protótipo

- Local: `VITE_CIVIC_DIRECTORY=1 VITE_CIVIC_NEWS=1 VITE_CIVIC_MOCK=1 npm run dev --prefix app` e abrir `#/candidatos` ou `#/noticias`. O transporte simulado (`app/src/civic/mock-transport.js`) serve as fixtures B01 com 250 ms de latência.
- Automatizado: `app/e2e/civic-navigation.mjs` percorre as jornadas em Chromium (e WebKit no CI) e, com `POLIMATCH_E2E_CIVIC_SHOTS=<pasta>`, grava as capturas listadas abaixo.

## Jornadas mapeadas

| Jornada | Caminho principal | Retorno | Falha explícita |
| --- | --- | --- | --- |
| Encontrar candidatura | `Candidatos` → recorte/disputa → busca ou filtros → cartão | `Voltar ao jogo` ou barra | filtro sem resultado; disputa sem publicação; denominador não reconciliado; limite/indisponível com repetição |
| Abrir integrante da chapa | ficha → seção "Chapa" com titular, vice ou suplentes e vigências | `Voltar à lista` | composição parcial com lacuna nomeada; composição não informada |
| Comparar propostas | dois ou três `Comparar` → barra fixa → grade por tema | `Escolher outras` | seleção inválida recusada sem requisição; tema sem afirmação como lacuna |
| Consultar acontecimento | `Notícias` → recorte → acontecimento → três espaços | `Voltar às notícias` | nenhuma edição hoje; espaço vazio com motivo; classificação pendente ou contestada |
| Informar erro | qualquer tela → painel de estado com título, detalhe e ação | `Voltar` | retirada (410), restrito (401/403), esquema inválido (`CIVIC_SCHEMA`), sem conexão |

Entrada pública (deep link ou barra sem rodada) e entrada durante uma rodada diferem só no retorno: na segunda, `Voltar ao jogo` devolve à rodada com as mesmas cartas e o foco volta ao acionador; nenhuma abertura confirma ou cancela escolha. A entrada por vínculo pessoa → candidatura a partir do perfil do jogo depende de `gameLinkReview: approved` e de endpoint B06; não foi prototipada.

## Matriz de estados ↔ fixtures

| Estado | Como aparece | Fixture/cenário do mock |
| --- | --- | --- |
| carregando | `role="status"` "Carregando…", `aria-busy` na tela, lista anterior esmaecida | latência do mock |
| vazio | mensagem específica: filtro sem resultado, disputa sem publicação, nenhuma edição para o recorte | `busca=ninguém`; `directory: empty`; `edition` para BR |
| erro/retry | título + detalhe + `Tentar de novo` / `Voltar` | `unavailable`, `network`, `timeout`, `schema` |
| parcial | linha de cobertura "X de Y publicadas; N sem publicação" | `directory: partial` (denominador +1) |
| não reconciliado | aviso "Cobertura oficial ainda não reconciliada" | `directory: unreconciled` (`coverage: null`) |
| pendente | fotografia com placeholder hachurado e legenda "aguarda revisão de direitos"; contador de afirmações não exibidas; espaço com "Classificação pendente" | `photo-pending` (B01); `candidacy: pending`; `event: pending` |
| desatualizado | aviso "Dados desatualizados: mostrando a última versão permitida" e lista anterior preservada | falha após leitura bem-sucedida; `freshness.staleAfter` no passado |
| corrigido | aviso "Corrigido em <data>: <motivo>" + histórico de revisões | `candidacy: corrected`, `event: corrected` |
| retirado | estado de erro "Conteúdo retirado"; registro sai das listas locais | `withdrawn` (410 com `entity`) |
| restrito | "Conteúdo restrito" sem convite a login | `restricted` (403) |
| limite | "Muitas consultas" com botão em contagem regressiva (`Retry-After`) | `rate-limited` (429) |
| combinação de filtros sem resultado | vazio com orientação "Limpe um filtro para ampliar" | busca inexistente |
| parâmetros ignorados | avisos por parâmetro (`uf` inválida, parâmetro desconhecido, texto acima do limite) | `#/candidatos?uf=XX&voto=1` |

## Inventário de componentes

Arquivos: `app/src/civic/ui/components.js`, `app/src/civic/ui/states.js`, `app/src/civic/ui/dom.js`, `app/src/civic/ui/civic.css`; modelos em `app/src/civic/view-models.js`.

| Componente | Propriedades (modelo) | Eventos/intents |
| --- | --- | --- |
| `sourceChip(source, { locator })` | publicador, URL HTTPS validada, localizador, data de coleta, tipo (oficial, campanha, redação, sintético) | link externo `rel="noreferrer noopener"` |
| `referenceDate(label, valueLabel)` | rótulo + data formatada em `America/Sao_Paulo` | — |
| `coverageLine(summary)` / `updateCoverageLine` | `coverageSummary` (completo, parcial, não reconciliado) | — |
| `officialStatusBadge(card)` | situação oficial e instante | — |
| `photoFigure(photo, { initials, name, size })` | estado `permitted`/`pending`/`denied`/`absent`, URL, crédito | — |
| `candidacyCard(card, { selectable, selected, onToggle })` / `updateCandidacyCard` | nome, número, partido ou "Sem partido informado", disputa, situação, fonte, foto | link para ficha (`data-civic-candidacy`), checkbox `Comparar` |
| `memberCard(member)` / `ticketSection(ticket)` | papel (Titular, Vice, 1º/2º suplente), pessoa, vigência, completude, lacunas nomeadas | — |
| `claimItem(claim)` | tipo (Proposta, Voto registrado, Medida executada, Resultado observado, Biografia), natureza textual (declaração de campanha, registro oficial, fato documentado), tema, texto, fonte + localizador | — |
| `coverageCard(slot)` | espaço (direita, esquerda, internacional), estado, matéria (manchete, tipo, acesso, redação e país, origem, republicação/tradução), versão/revisão da classificação, relevância, metodologia, motivo da lacuna, data de verificação | link externo da matéria |
| `eventCard(event)` | título, resumo, tema, recorte, período, contagem "N de 3 espaços" | link para acontecimento (`data-civic-event`) |
| `filterBar({ onSubmit, onReset })` + `setContestOptions` | recorte (BR + 27 UFs), disputa, busca, partido, situação | `submit`, `change` de recorte/disputa, `Limpar` |
| `compareBar({ onCompare, onClear })` | contagem "n de 3 selecionadas" | `Comparar` (2–3), `Limpar seleção` |
| `screenHeader`, `actionRow`, `button` | eyebrow, `h1` focável, lead | ações `data-civic-action` (`retry`, `back`, `compare`, `load-more`) |
| `createStatePanel` + `noticesFor` | status, erro, texto de vazio, avisos por tom (`info`, `warning`, `pending`, `stale`, `corrected`, `withdrawn`, `restricted`) | `Tentar de novo`, `Voltar` |

Contrato para F02–F06: telas recebem `view = { route, state, resolved, fromRoute }` e devolvem `{ kind, root, mount, update, unmount, focusInitial }` (ver [A01](../app/A01-contract.md)); dados chegam como registros B01 já validados e viram modelos por `view-models.js`; nenhuma tela infere candidatura, aprovação, posição política, qualidade ou relação de chapa.

## Hierarquia visual e equivalência

- Shell malaquita existente; leitura factual em superfícies porcelana (`--paper`) com tinta `--ink`; avisos em faixas com borda lateral por tom. Ouro só no foco visível e no estado ativo da barra, herdados do jogo; nenhuma cor de mérito, acabamento de coleção, Elo ou ranking nas áreas cívicas.
- Cartões com a mesma grade (foto 84 px, corpo), mesma altura mínima, mesmos slots (nome, número, partido, disputa, situação, fonte, comparar), na ordem do contrato (alfabética com desempate por ID). O E2E confere larguras iguais no desktop.
- Fato documentado, declaração de campanha, opinião e rótulo metodológico distinguem-se por etiquetas textuais (`civic-tag`), não por cor.
- Tokens novos: nenhum; o CSS (`civic.css`) reutiliza `--paper`, `--ink`, `--muted`, `--line`, `--gold`, `--negative` e a folha `nav-more-sheet` para a proposta de navegação.

## Semântica, ordem de tabulação e foco

- `section.civic-view[aria-labelledby]` com `h1[tabindex=-1]` focado ao entrar; título do documento por rota.
- Um `role="status"` (`aria-live="polite"`, atômico) por tela anuncia carregando, vazio e erro; avisos secundários em lista estática; `aria-busy` na tela durante leitura.
- Ordem de Tab verificada no E2E: título → recorte → disputa → busca → partido → situação → ações → cartões (link do nome, checkbox Comparar). Formulário com `role="search"` e rótulos visíveis.
- Sem `dialog` novo; a folha `Mais` tem `aria-expanded`/`aria-controls`, fecha com Escape devolvendo foco ao botão e fecha ao clicar fora.
- DOM preservado em atualizações: listas reconciliadas por chave; texto via `textContent`; links externos só HTTPS validado com `target=_blank` e `rel="noreferrer noopener"`; nada do material coletado vira HTML.
- Zoom até 200% e leitores de tela (NVDA/VoiceOver): especificação apenas; não foram medidos nesta entrega.

## Mapa de responsabilidades

| FRONT | APP | BACK |
| --- | --- | --- |
| `ui/components.js`, `ui/states.js`, `ui/screens.js`, `ui/dom.js`, `civic.css`, este documento | `router.js`, `shell.js`, `flags.js`, `client.js`, `store.js`, `uf-preference.js`, hooks em `main.js`, E2E e CI | contrato B01, importação B02/B04, endpoints e publicação (B06) |
| coedição anunciada: `view-models.js` | coedição anunciada: `view-models.js`, `mock-transport.js` | — |

## Proposta de navegação

Com alguma área ligada: `Início · Jogar · Candidatos · Notícias · Mais`, com `Ranking` e `Coleção` dentro de `Mais`. Com as áreas desligadas, a barra atual permanece intacta. Hipótese a validar por produto; reversível por flag.

## Capturas do protótipo

Geradas pelo E2E em Chromium (viewport 390×844 e 1280×800, página inteira, JPEG), gravadas em `../output/F01-screens/`: diretório (mobile e desktop), diretório com filtro sem resultado, diretório desatualizado (limite com lista preservada), diretório em erro de limite, ficha (mobile e desktop), ficha retirada, comparação, notícias, notícias sem edição, acontecimento (mobile e desktop), destino inexistente, folha `Mais` aberta. O commit correspondente está em `../output/F01-verification.json`.

## Decisões e dúvidas registradas

- Fotografia pendente usa placeholder hachurado com iniciais; ausência usa placeholder liso. Decisão de FRONT para tornar o estado visível sem inventar imagem.
- Denominador oficial ausente é sinalizado, não convertido em zero (segue B01).
- Edição sem publicação para o recorte é estado vazio, não erro (o mock devolve 404 `CIVIC_NO_EDITION`; B06 pode preferir 200 com lista vazia — a única mudança seria no store).
- Dúvida para produto: manter `Ranking` dentro de `Mais` ou trazer `Notícias` para `Mais` e manter `Ranking` na barra. Ambas cabem em cinco botões.
- Dúvida para editorial: rótulos "declaração de campanha", "registro oficial" e "fato documentado" para as naturezas das afirmações; e a frase "internacional não é selo de neutralidade" nos espaços de cobertura.

## Feedback humano

Pendente. Nenhuma sessão de produto, editorial, usabilidade ou revisão assistiva ocorreu; este documento e o E2E não a substituem.
