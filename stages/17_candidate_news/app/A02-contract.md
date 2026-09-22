# A02 — cliente, estado público e preferência de UF (#224)

Implementação de [A02](microissues/A02.md) sobre o contrato [B01](../back/B01-contract.md). Tudo em `app/src/civic/`, sem tocar em `app/src/api.js` além de reutilizar `apiUrl`. Leitura pública anônima: `credentials: "omit"`, nenhum token, nenhuma chave de recuperação, nenhuma preferência do jogo.

## Módulos

| Módulo | Papel |
| --- | --- |
| `client.js` | `createCivicClient` com timeout, cancelamento por `AbortSignal`, uma repetição automática só para falhas de transporte, mapeamento de erros e `validateEnvelope` (versão, revisão, registros por `validateCivicRecord`, cobertura, histórico sem identidade de editor, frescor). |
| `store.js` | Um estado por área (`contests`, `directory`, `candidacy`, `comparison`, `edition`, `event`) com época por requisição, cancelamento, cache por chave, retenção da última versão permitida, invalidação por retirada e `retry` respeitando `Retry-After`. |
| `uf-preference.js` | Escolha manual Brasil/UF validada contra os 27 códigos, chave `polimatch:civic:uf`, fallback em memória e `clear()`. |
| `view-models.js` | Modelos de apresentação para FRONT (cartão, chapa, afirmações, cobertura por espaço, edição, comparação, cobertura do recorte, frescor, histórico, erros). |
| `mock-transport.js` | Fixtures B01 servidas nos envelopes abaixo, com cenários de contraste; usado por testes, E2E e `VITE_CIVIC_MOCK=1`. |

## Envelope público proposto para B06

Todos os endpoints são `GET` e devolvem `{ version: 1, revision, records, ...meta }`. `records` só contém tipos do contrato B01 já validados, nunca `changes`/`versions` (internos). `meta` opcional: `nextCursor`, `filteredCount`, `coverage` (ou `null` quando o denominador oficial não foi reconciliado), `subject`, `history` (`{ revision, action, at, reason }`, sem `actor`) e `freshness` (`{ collectedAt, staleAfter }`).

| Cliente | Caminho (a confirmar por B06) | Notas |
| --- | --- | --- |
| `contests({ jurisdiction })` | `/api/civic/v1/contests?jurisdiction=` | disputas e eleições do recorte |
| `directory(query)` | `/api/civic/v1/directory?contestId=&party=&officialStatus=&search=&limit=&cursor=` | filtros do B01; 409 `CIVIC_STALE_CURSOR` reinicia a paginação |
| `candidacy(id, { revision })` | `/api/civic/v1/candidacies/:id` | pessoa, disputa, chapas, integrantes, afirmações, fotografias, fontes |
| `comparison(ids)` | `/api/civic/v1/comparisons?ids=a,b,c` | 2–3 IDs da mesma disputa; 400 `CIVIC_INVALID` |
| `currentEdition({ jurisdiction })` | `/api/civic/v1/editions/current?jurisdiction=` | 404 = nenhuma edição, tratado como vazio |
| `edition(id)` / `event(id)` | `/api/civic/v1/editions/:id`, `/api/civic/v1/events/:id` | 410 devolve `entity { kind, id, revision }` |

Erros: `{ "error": { "code", "message", "retryAfterSeconds"?, "entity"? } }` e cabeçalho `Retry-After` em 429/503. O cliente nunca mostra `message` do servidor como HTML.

## Convenção de estados

`CivicReadError.kind` → estado: `invalid`, `restricted` (401/403, sem login automático), `not-found`, `stale-cursor`, `withdrawn` (410), `rate-limited` (429 + `retryAt`), `unavailable` (5xx), `offline`, `network`, `timeout`, `aborted`, `schema` (`CIVIC_SCHEMA`, com detalhe rastreável do registro inválido). Cada área do store expõe `status ∈ idle|loading|ready|empty|error`, `error`, `stale`, `retryAt`, `fetchedAt`, `revision`.

Regras verificadas por teste (`app/src/civic-client.test.js`, `app/src/civic-store.test.js`):

- Resposta antiga não sobrescreve filtro ou rota mais recente (época por requisição); trocar UF durante a leitura descarta a resposta do recorte anterior.
- Falha transitória depois de uma leitura bem-sucedida mantém a última versão permitida, marcada `stale`, com `Retry-After` respeitado por `retry`.
- 410 invalida a entrada local e remove o registro das listas carregadas; a versão anterior não é exibida.
- Comparação incompatível conhecida (disputas diferentes, duplicata, quantidade) é recusada com explicação e sem requisição; IDs desconhecidos vão ao servidor, que valida.
- Registros publicáveis fora de `published/approved` chegam marcados e são exibidos só como pendentes (fotografia, afirmação), nunca como aprovados.
- Ausência de edição, retirada, desatualização, falha de coleta e classificação pendente/contestada permanecem estados distintos.

## Preferência de UF

Seleção manual em Candidatos e Notícias; gravada em `polimatch:civic:uf` (fora de `polimatch:v4:*`), lida na abertura, com fallback em memória quando o storage falha ou está corrompido e `clear()` para reset. Deep link com `uf=` não altera a preferência; só a escolha no seletor grava. Não há geolocalização, sincronização entre dispositivos, vínculo com voto, chave de recuperação ou identidade Google. O E2E confere que a única chave cívica no `localStorage` é essa.

## Fluxo de dados

`shell.js` traduz a rota em leituras (`loadFor`): disputas do recorte → diretório com a disputa resolvida; ficha, comparação, edição e acontecimento por ID. Entrar numa rota sempre revalida com o servidor (conteúdo retirado não reaparece ao voltar no histórico); atualizações do store só disparam leituras cuja chave mudou. As telas recebem `store.getState()` e desenham via `view-models.js`.

## Pendências e gate

Endpoints reais (B06) e integração ponta a ponta (A04) ficam fora desta unidade; os caminhos acima são proposta. Produto revisa textos e recuperação de erro; privacidade confirma a preferência local e a ausência de vínculos com dados do jogador. Nenhuma dessas revisões ocorreu.
