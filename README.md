# PoliMatch

PoliMatch é um jogo web casual de comparação entre personalidades públicas. A pessoa escolhe uma das duas cartas, recebe o próximo duelo imediatamente e acompanha rankings geral e pessoal. É entretenimento: **não constitui pesquisa eleitoral**.

## Produto atual

- Interface reconstruída na direção `Malaquita 2026 / Digital First`.
- Aplicação online-only: um voto só altera a tela depois da confirmação do servidor.
- Duelo contínuo; o ranking abre apenas quando a pessoa pedir.
- Toque na carta escolhe; pressão longa abre a ficha educativa sem votar.
- Carta padrão neutra para todos.
- Chromas são personalizações pessoais e futuras; não alteram Elo, pareamento ou voto.

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
DATABASE_URL=postgresql://usuario:senha@localhost:5432/polimatch npm run dev:back
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
| `GET` | `/api/topics` | assuntos ativos e anunciados |
| `GET` | `/api/candidates?topic=eleicoes-2026` | pessoas da curadoria |
| `GET` | `/api/ranking?topic=eleicoes-2026` | ranking agregado |
| `POST` | `/api/player` | cria identidade anônima e chave de recuperação |
| `GET` | `/api/player/state?topic=eleicoes-2026` | ranking pessoal; exige chave Bearer |
| `POST` | `/api/vote` | confirma um duelo global e pessoal numa transação |

O PostgreSQL guarda somente o hash da chave de recuperação. Votos possuem UUID idempotente e são imutáveis.

## Deploy no Dokploy

API:

- contexto: repositório inteiro;
- Dockerfile: `back/Dockerfile`;
- porta: `3001`;
- variável obrigatória: `DATABASE_URL`;
- healthcheck: `GET /api/health`.

App:

- contexto: repositório inteiro;
- Dockerfile: `app/Dockerfile`;
- porta: `80`;
- build arg: `VITE_API_URL=https://api.polimatch.com.br`.

O domínio público `polimatch.com.br` aponta para o app; `api.polimatch.com.br`, para a API. HTTPS é obrigatório para o PWA. A publicação só deve ocorrer depois do gate visual e fotográfico.

## Fonte de verdade

Decisões e estado da reconstrução:

- `CONTEXT.md`
- `stages/10_rebuild_eleicoes_2026/CONTEXT.md`
- `stages/10_rebuild_eleicoes_2026/output/HANDOFF.md`
- `stages/10_rebuild_eleicoes_2026/output/verification.json`
