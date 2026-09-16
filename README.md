# PoliMatch

PoliMatch é um jogo web casual de comparação entre personalidades públicas. A pessoa escolhe sua preferida entre quatro cartas, recebe uma nova rodada imediatamente e acompanha seu ranking pessoal. Superfícies agregadas permanecem retidas por padrão enquanto a decisão humana da issue #177 estiver pendente.

## Produto atual

- Interface reconstruída na direção `Malaquita 2026 / Digital First`.
- Aplicação online-only: um voto só altera a tela depois da confirmação do servidor.
- Rodada do dia com dez escolhas fixas de quatro cartas, iguais para todos na mesma data editorial de São Paulo; o progresso retoma no slot autoritativo.
- Duelo contínuo; o ranking abre apenas quando a pessoa pedir.
- Toque na carta escolhe; pressão longa abre a ficha educativa sem votar.
- Carta padrão neutra para todos.
- Chromas são personalizações pessoais e futuras; não alteram Elo, pareamento ou voto.
- O acesso com Google é opcional: preserva o jogador anônimo atual e permite recuperar o mesmo progresso em outro aparelho.

O catálogo mestre possui 125 pessoas:

- `Eleições 2026`: 100 nomes políticos no assunto ativo;
- `Influenciadores`: 25 perfis preparados para a próxima área;
- `Escândalos e acontecimentos`: estrutura anunciada, ainda sem curadoria ativa.

Os 125 perfis estão em revisão editorial. O catálogo de 1.500 Chromas contém 12 rascunhos por pessoa e permanece fora do fluxo público até passar por fonte, arte e aprovação.

## Estrutura

```text
app/       frontend Vite/PWA
back/      API Express e persistência PostgreSQL
shared/    catálogo canônico e cálculo Elo compartilhado
stages/    contexto, entradas, auditorias e handoff do programa ICM
```

O frontend antigo em `front/` foi removido na reconstrução. Seu histórico continua disponível no Git.

## Desenvolvimento

Requisitos: Node.js 20+, npm e PostgreSQL para executar a API.

```sh
npm install --prefix app
npm install --prefix back
```

API:

```sh
DATABASE_URL=postgresql://usuario:senha@localhost:5432/polimatch \
GOOGLE_CLIENT_ID=seu-cliente-web.apps.googleusercontent.com \
npm run dev:back
```

App:

```sh
npm run dev:app
```

Por padrão, o Vite abre o app em `http://localhost:5174` e encaminha `/api` para `http://localhost:3001`.

## Testes e build

```sh
npm test
npm run build
```

O app compilado fica em `app/dist`.

## Catálogo editorial

As fontes de edição estão em `stages/10_rebuild_eleicoes_2026/input/`. Para reconstruir deterministicamente o catálogo de pessoas e o rascunho de Chromas:

```sh
npm run build:catalog --prefix back
```

Saídas:

- `shared/elections-2026.json`: 125 pessoas e seus perfis;
- `stages/10_rebuild_eleicoes_2026/output/chromas-catalog-draft.json`: 1.500 Chromas bloqueadas como rascunho.

Não edite essas saídas manualmente. Corrija a entrada e execute o importador novamente.

## API

| Método | Rota | Função |
|---|---|---|
| `GET` | `/api/health` | saúde da API e do PostgreSQL |
| `GET` | `/api/capabilities` | estado fail-closed dos quatro escopos de publicação agregada; sempre `no-store` |
| `GET` | `/api/topics` | assuntos ativos e anunciados |
| `GET` | `/api/candidates?topic=eleicoes-2026` | pessoas da curadoria |
| `GET` | `/api/ranking?topic=eleicoes-2026` | ranking agregado; exige receipt válida de `global-ranking` |
| `POST` | `/api/player` | cria identidade anônima e chave de recuperação |
| `GET` | `/api/player/state?topic=eleicoes-2026` | ranking pessoal; exige chave Bearer |
| `GET` | `/api/daily-session?topic=eleicoes-2026` | edição diária e progresso autoritativo do jogador; exige chave Bearer |
| `GET` | `/api/daily-cut?topic=eleicoes-2026&date=AAAA-MM-DD` | recorte agregado imutável; exige receipt válida de `daily-distribution` |
| `POST` | `/api/daily-prediction` | registra previsão separada; exige receipt válida de `prediction-reveal` |
| `GET` | `/api/daily-prediction-results?topic=eleicoes-2026` | revela apuração fechada; exige Bearer e receipt válida de `prediction-reveal` |
| `POST` | `/api/auth/google` | valida a credencial Google no servidor, liga a conta ao jogador atual e emite uma sessão própria |
| `POST` | `/api/auth/logout` | revoga a sessão própria atual |
| `POST` | `/api/daily-vote` | confirma o próximo slot diário por `editionId`, `slot`, `winnerId` e `answerId`; a ordem das cartas nunca vem do cliente |
| `POST` | `/api/round-vote` | confirma uma escolha entre quatro pessoas numa transação; exige `roundId`, `winnerId`, quatro `candidateIds` únicos e `playerVersion` |
| `POST` | `/api/vote` | endpoint binário aposentado; responde `410 ROUND_V4_REQUIRED` para impedir contagem incompatível por clientes antigos |

Exemplo do corpo atual:

```json
{
  "roundId": "550e8400-e29b-41d4-a716-446655440000",
  "winnerId": "lula",
  "candidateIds": ["lula", "jair-bolsonaro", "anitta", "neymar-jr"],
  "topicId": "eleicoes-2026",
  "playerVersion": 3
}
```

O PostgreSQL guarda somente hashes das chaves de recuperação e sessões. O token de identidade do Google não é persistido; a ligação usa o `sub` validado pelo servidor. A rodada é idempotente e imutável; ela avança a escolha uma vez e mantém três comparações Elo vinculadas ao mesmo `roundId`. Escritas exigem sessão emitida pelo servidor e seguem a [política de integridade do voto](docs/security/VOTE_ABUSE_POLICY.md).

Respostas de voto usam o contrato V2: o canal pessoal fica em `player`/`round`/`vote`; qualquer publicação autorizada fica exclusivamente em `publicAggregate`. Não há fallback V1. O gate completo, o formato de autoridade externa e o limite jurídico do mecanismo estão em [Gate de publicação agregada](docs/legal/AGGREGATE_PUBLICATION_GATE.md).

A edição diária persiste ruleset, versão da ficha pública (`catalogSchema`), janela, dez slots e o snapshot editorial completo antes do primeiro jogador. Retirar uma pessoa ou ampliar a projeção da API corrente não reescreve a edição aberta nem seu recorte: sessões históricas e cortes publicados continuam autoexplicativos pelo snapshot e seus hashes. Um schema novo só estreia junto de um ruleset novo, numa data ainda não materializada. Somente sessões concluídas em `10/10` entram no recorte público.

## Deploy no Dokploy

API:

- contexto: repositório inteiro;
- Dockerfile: `back/Dockerfile`;
- porta: `3001`;
- variável obrigatória: `DATABASE_URL`;
- segredo obrigatório de produção: `VOTER_NETWORK_SECRET=<valor aleatório com ao menos 32 caracteres>`;
- topologia obrigatória de produção: `TRUST_PROXY_HOPS=<quantidade exata de proxies confiáveis até a API>`;
- para ativar o login: `GOOGLE_CLIENT_ID=<OAuth Web Client ID>`;
- origem padrão de produção: somente `https://polimatch.com.br`; ambientes adicionais exigem `APP_ORIGINS=https://polimatch.com.br,https://staging.exemplo`;
- healthcheck: `GET /api/health`.
- revisão do release: construa a imagem da API com `--build-arg SOURCE_COMMIT=<SHA completo do checkout>`; o Dockerfile grava a revisão no artefato e a receipt deve conter o mesmo `releaseRevision`;
- publicação agregada: `AGGREGATE_AUTHORITY_RECEIPTS=<array JSON>` é a única entrada operacional. JWK, emissor e `keyId` precisam estar previamente pinados no artefato versionado; enquanto o keyring estiver vazio ou qualquer vínculo falhar, todos os escopos permanecem bloqueados.

App:

- contexto: repositório inteiro;
- Dockerfile: `app/Dockerfile`;
- porta: `80`;
- build arg: `VITE_API_URL=https://api.polimatch.com.br`;
- para ativar o botão oficial: `VITE_GOOGLE_CLIENT_ID=<mesmo OAuth Web Client ID>`.

No Google Cloud, o cliente OAuth deve ser do tipo aplicação Web e autorizar a origem JavaScript `https://polimatch.com.br`. Se as duas variáveis de Google estiverem ausentes, o jogo anônimo continua funcionando e nenhuma entrada quebrada é exibida.

O contrato de voto V2 é incompatível com frontend/backend antigos em rolling mix. Faça deploy coordenado do par construído do mesmo commit e rollback também coordenado; a ordem, os smokes e a proibição de fallback V1 estão documentados no [gate de publicação agregada](docs/legal/AGGREGATE_PUBLICATION_GATE.md#deploy-coordenado-do-contrato-v2).

O domínio público `polimatch.com.br` aponta para o app; `api.polimatch.com.br`, para a API. HTTPS é obrigatório para o PWA. A publicação só deve ocorrer depois do gate visual e fotográfico.

## Fonte de verdade

Decisões e estado da reconstrução:

- `CONTEXT.md`
- `stages/10_rebuild_eleicoes_2026/CONTEXT.md`
- `stages/10_rebuild_eleicoes_2026/output/HANDOFF.md`
- `stages/10_rebuild_eleicoes_2026/output/verification.json`
- `stages/11_google_login/CONTEXT.md`
- `stages/11_google_login/output/HANDOFF.md`
