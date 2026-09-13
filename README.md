# Presidência Duelo 2026

Monorepo do jogo web casual estilo **Facemash**: duas pessoas da vida pública brasileira lado a lado; você escolhe uma; surge o próximo par aleatório; o ranking Elo fica no `localStorage` e, se a API estiver no ar, também num agregado no servidor.

Além do duelo contínuo, a aba **Torneio** sorteia 12 pessoas do catálogo para um mata-mata: oito disputam a primeira rodada e quatro avançam direto, seguindo por quartas, semifinais e final. São 11 escolhas até o resultado, que pode ser compartilhado. O torneio é salvo separadamente e não altera o Elo local nem o agregado da API.

O catálogo de duelo contém os **360 nomes aprovados** e perfis básicos. Chromas, versões históricas e suas artes serão modeladas em outra área do app; não fazem parte deste arquivo nem alteram o ranking atual.

> **Não é pesquisa oficial.** Não mede intenção de voto real. É só entretenimento.

```
/
  README.md                 # este guia
  CREDITS.md                # atribuição das fotos e fontes públicas
  shared/                   # catálogo aprovado de pessoas + Elo compartilhado
  front/                    # UI web (Vite + vanilla JS)
  back/                     # API (Node + Express)
  app/                      # PWA (wrapper do mesmo jogo + manifest/SW)
```

Os 360 perfis do catálogo têm fotos de fontes públicas e crédito registrado: 69 arquivos locais e 291 imagens servidas diretamente pelo Wikimedia Commons. Nenhuma face foi gerada por IA.

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
| `GET` | `/api/candidates` | 360 pessoas (`personId`, `id`, `name`, `party`, `vice`, `photo`, `initials`) |
| `GET` | `/api/ranking` | Ranking Elo agregado armazenado no PostgreSQL |
| `POST` | `/api/vote` | Corpo `{ "winnerId", "loserId" }` — atualiza o Elo do servidor |

CORS está aberto para o front local. A API exige `DATABASE_URL` e grava o ranking e cada voto no PostgreSQL usando uma transação. No primeiro início, se o banco estiver vazio, `back/data/elo.json` é importado automaticamente uma única vez para preservar o agregado anterior.

### 2. Front web (`front`)

```bash
npm run dev --prefix front
# http://localhost:5173
```

O Vite faz proxy de `/api` para `http://localhost:3001`. Com a API ligada, o jogo lista candidatos pelo back e envia votos. **Se a API estiver fora, o front cai no JSON local + `localStorage`** — o duelo anônimo continua igual.

No modo Duelo, também é possível votar rapidamente com **← / →** no desktop ou deslizando a área dos cards para a esquerda/direita no celular.

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

No celular: abra o `app` no navegador → “Adicionar à tela inicial”. O PWA exige conexão com a API: cada voto é confirmado no servidor antes de alterar o Elo no aparelho, mantendo o ranking individual e o agregado sincronizados. O service worker é registrado apenas em `http:` ou `https:` e nunca fornece uma versão jogável offline.

O ranking agregado de **Pessoas** continua usando no PostgreSQL a chave histórica `presidentes`, preservando os votos já existentes. O pool legado de vices permanece compatível no backend, mas fica oculto nesta primeira versão do catálogo ampliado.

## Deploy no Dokploy

### Front estático (principal)

1. Build: `cd front && npm ci && npm run build`
2. **Publish directory:** `front/dist`
3. SPA: fallback para `index.html`
4. Variável `VITE_API_URL` no build, apontando para o serviço da API

### API obrigatória para o PWA

Crie um serviço **Application** usando o repositório inteiro como contexto:

1. Dockerfile: `back/Dockerfile`
2. Porta: `3001`
3. Healthcheck: `GET /api/health`
4. Domínio sugerido: `api.seu-dominio.com`
5. Variável de execução: `DATABASE_URL`, usando a URL interna de um PostgreSQL
6. Mantenha o volume legado em `/repo/back/data` no primeiro deploy para importar o `elo.json`; depois da importação ele deixa de ser necessário

Configure backups periódicos para o PostgreSQL antes de abrir o jogo ao público.

Se o front e a API ficarem no mesmo domínio, deixe `VITE_API_URL` vazio e encaminhe `/api` para o serviço Node.

### App PWA online

Crie outro serviço **Application**, também com o repositório inteiro como contexto:

1. Dockerfile: `app/Dockerfile`
2. Porta: `80`
3. Build arg: `VITE_API_URL=https://api.seu-dominio.com`
4. Aponte o domínio público do jogo para este serviço
5. Ative HTTPS para permitir instalação e registro do service worker

Depois do deploy, valide `/manifest.webmanifest`, `/sw.js` e `/api/health`. O PWA mostra “Conexão necessária” se a API não responder e não altera estatísticas locais nesse estado.

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
- Com API: cada escolha também incrementa o Elo agregado e registra o voto no PostgreSQL (sem login, sem cookie de identidade).
- Zerar ranking no UI limpa só o aparelho, não o banco do servidor.

## Licença

Código: use livremente. Fotos: veja `CREDITS.md` (licenças CC / Attribution).
