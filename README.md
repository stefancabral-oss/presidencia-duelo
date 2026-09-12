# Presidência Duelo 2026

Monorepo do jogo web casual estilo **Facemash**: dois candidatos à Presidência do Brasil (2026) lado a lado; você escolhe um; surge o próximo par aleatório; o ranking Elo fica no `localStorage` e, se a API estiver no ar, também num agregado no servidor.

Além do duelo contínuo, a aba **Torneio** oferece um mata-mata conclusivo com os 12 candidatos: oito disputam a primeira rodada e quatro avançam direto, seguindo por quartas, semifinais e final. São 11 escolhas até a tela “Seu presidente é X”, com compartilhamento do resultado. O torneio é salvo separadamente e não altera o Elo local nem o agregado da API.

> **Não é pesquisa oficial.** Não mede intenção de voto real. É só entretenimento.

```
/
  README.md                 # este guia
  CREDITS.md                # atribuição das fotos (Wikimedia)
  shared/                   # lista dos 12 candidatos + Elo compartilhado
  front/                    # UI web (Vite + vanilla JS)
  back/                     # API (Node + Express)
  app/                      # PWA (wrapper do mesmo jogo + manifest/SW)
```

Pablo Marçal **não** está na lista. Fotos reais em `front/public/candidates/` — nenhuma face gerada por IA.

## Requisitos

- Node.js 20+ (testado com 22)
- npm

```bash
npm install --prefix front
npm install --prefix back
npm install --prefix app
```

## Como rodar cada parte

### 1. API (`back`)

```bash
npm run dev --prefix back
# http://localhost:3001
```

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/health` | Saúde do serviço |
| `GET` | `/api/candidates` | 12 candidatos (`id`, `name`, `party`, `vice`, `photo`, `initials`) |
| `GET` | `/api/ranking` | Ranking Elo agregado (arquivo JSON em `back/data/elo.json`) |
| `POST` | `/api/vote` | Corpo `{ "winnerId", "loserId" }` — atualiza o Elo do servidor |

CORS está aberto para o front local. Sem banco: o agregado fica em memória + `back/data/elo.json` (não versionado).

### 2. Front web (`front`)

```bash
npm run dev --prefix front
# http://localhost:5173
```

O Vite faz proxy de `/api` para `http://localhost:3001`. Com a API ligada, o jogo lista candidatos pelo back e envia votos. **Se a API estiver fora, o front cai no JSON local + `localStorage`** — o duelo anônimo continua igual.

Build estático:

```bash
npm run build --prefix front
# pasta de publicação: front/dist
```

Para apontar o front compilado a uma API remota:

```bash
VITE_API_URL=https://sua-api.exemplo.com npm run build --prefix front
```

Se `VITE_API_URL` estiver vazio, as chamadas usam `/api` (útil atrás de um proxy reverso).

### 3. App PWA (`app`)

Casca instalável do **mesmo jogo** (`front/src/game.js` + fotos). Inclui `manifest.webmanifest` e service worker. Não é um app nativo iOS — é um PWA deployável como site estático.

```bash
npm run dev --prefix app
# http://localhost:5174
```

O script `predev`/`prebuild` copia `front/public/candidates`, ícones, `CREDITS.md` e `og-cover.png` para `app/public/`.

```bash
npm run build --prefix app
# pasta de publicação: app/dist
```

No celular: abra o `app` no navegador → “Adicionar à tela inicial”. Offline, o SW serve o shell e as fotos já cacheadas. Votos anônimos seguem no `localStorage`; o `POST /api/vote` só ocorre se a API responder.

## Deploy no Dokploy

### Front estático (principal)

1. Build: `cd front && npm ci && npm run build`
2. **Publish directory:** `front/dist`
3. SPA: fallback para `index.html`
4. Opcional: variável `VITE_API_URL` no build, apontando para o serviço da API

### API opcional

1. Root do serviço: `back`
2. Install: `npm ci`
3. Start: `npm start` (ou `node src/server.js`)
4. Porta: `3001` (ou `PORT`)
5. Healthcheck: `GET /api/health`
6. Persistência: monte um volume em `back/data` se quiser manter o Elo entre deploys

Se o front e a API ficarem no mesmo domínio, deixe `VITE_API_URL` vazio e encaminhe `/api` para o serviço Node.

### App PWA (alternativa ao front)

1. Build: `cd app && npm ci && npm run build`
2. **Publish directory:** `app/dist`
3. Mesmas regras de proxy `/api` que o front

## Candidatos incluídos

1. Lula (PT) — Geraldo Alckmin (PSB)
2. Flávio Bolsonaro (PL) — Alfredo Gaspar (PL)
3. Ronaldo Caiado (PSD) — Gilberto Kassab (PSD)
4. Romeu Zema (Novo) — Eduardo Girão (Novo)
5. Renan Santos (Missão) — Aroldo Medina (Missão)
6. Augusto Cury (Avante) — Júlio Delgado (Avante)
7. Rui Costa Pimenta (PCO) — Antônio Carlos (PCO)
8. Samara Martins (UP) — Raquel Brício (UP)
9. Hertz Dias (PSTU) — Vanessa Portugal (PSTU)
10. Edmilson Costa (PCB) — Cleusa Santos (PCB)
11. Wilson Grassi (Democrata) — Suêd Haidar (Democrata)
12. Clariana Barão (DC) — Fabiana Torquato (DC)

## Privacidade

- Jogo anônimo: ranking local em `localStorage` (`presidencia-duelo-v1`), mesmo sem API.
- Com API: cada escolha também incrementa o Elo agregado do servidor (sem login, sem cookie de identidade).
- Zerar ranking no UI limpa só o aparelho, não o arquivo do servidor.

## Licença

Código: use livremente. Fotos: veja `CREDITS.md` (licenças CC / Attribution).
