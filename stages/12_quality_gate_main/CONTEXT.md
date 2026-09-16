# [ICM 12] Portão de qualidade da `main`

## Objetivo

Fazer cada mudança chegar à `main` com evidência automática da camada que ela altera, sem misturar unidades independentes.

## Macro e unidade ativa

- Macro: [#175 — Portão de qualidade para main](https://github.com/stefancabral-oss/presidencia-duelo/issues/175).
- Unidades concluídas: `U01`/#174 pela PR #185; `U02`/#165 pela PR #186; `U03`/#168 pela PR #187; e `U04`/#169 pela PR #188, com os hotfixes isolados #189 e #190.
- Unidade ativa: `U05`, [#170 — limite, identificação e CORS do voto público](https://github.com/stefancabral-oss/presidencia-duelo/issues/170).
- Próxima unidade: [#171 — o portão de publicação ignora a revisão editorial](https://github.com/stefancabral-oss/presidencia-duelo/issues/171), somente depois do gate de U05.

## Escopo de U05

- declarar antes do código quem pode votar, os limites e as limitações da proteção;
- exigir sessão opaca emitida pelo servidor em toda escrita de ranking;
- limitar persistentemente rodadas por jogador e emissões anônimas por pseudônimo de rede;
- preservar replay idempotente sem cobrar nova cota;
- restringir CORS às origens realmente servidas e falhar fechado em produção;
- devolver erros `5xx` genéricos com correlação, mantendo o detalhe somente no log;
- congelar rodada e contadores até a confirmação completa do servidor;
- dar saídas explícitas para `401`, `429`, `5xx` e resultado de rede incerto;
- publicar uma explicação curta e honesta de como o placar é protegido.

## Exclusões de U05

- não prometer unicidade civil nem classificar o placar como pesquisa eleitoral;
- não exigir login Google para jogar anonimamente;
- não alterar catálogo, critérios editoriais ou o portão de publicação da #171;
- não reabrir a hierarquia de carta, o sistema responsivo ou o ranking pessoal já integrados;
- não trazer código das branches antigas de #166, #169 ou #170.

## Dependência resolvida

U05 nasceu de `main@dbf55ca`, depois da integração de U04 e dos hotfixes isolados #189/#190. A branch antiga de #170 foi descartada por conter escopos misturados; esta unidade foi reconstruída sobre a `main` limpa.

## Critérios de aceite

- política normativa versionada antes da implementação;
- sessão obrigatória e cotas persistentes de 8 rodadas/minuto, 30/dia e 3 emissões anônimas/dia/rede;
- prova PostgreSQL de que o abuso é bloqueado e o replay idempotente não consome cota;
- origem canônica aceita, origem hostil e `www` não servido rejeitados, origens locais limitadas a desenvolvimento;
- produção não inicia sem segredo de rede e configuração explícita de proxies confiáveis;
- `5xx` responde apenas mensagem genérica, código e `requestId`, com detalhe estruturado no log;
- estados `sending`, `401`, `429` e `5xx` preservam rodada, contador e tentativa original em Chromium e WebKit;
- testes de back/app, build e smokes de interação, responsividade e recuperação passam.

## Human gate

Stefan autorizou a integração automática das unidades que estiverem isoladas, revisadas, testadas e com CI verde. Essa autorização não substitui os gates técnicos nem permite empilhar #171 nesta PR.

## Unidade isolada U02 — persistência do DOM (#166)

U02 é desenvolvida na branch `icm/12-u02-dom-persistence-166` sem alterar o estado nem os artefatos de U01. Seu objetivo é remover a reconstrução integral do frontend durante um voto e tornar observáveis os estados da rodada sem depender de refoco corretivo.

### Escopo de U02

- montar uma única vez shell, topbar, navegação, painéis, instrução, região viva e quatro slots de carta;
- atualizar texto, atributos, classes, fotografias e resultados nos mesmos quatro controles;
- registrar os eventos da aplicação uma vez, usando delegação para conteúdo dinâmico;
- manter o botão votado focado e com foco visível durante confirmação, resultado e nova rodada;
- anunciar `Confirmando`, o resultado confirmado e `Nova rodada disponível` pela mesma região `role="status"`;
- provar identidade e foco com teste unitário e smoke real em Chromium e WebKit.

### Exclusões de U02

- caminho de teclado para abrir perfil, dica móvel e correção modal, que pertencem à #167;
- mudanças de backend, contrato de voto, autenticação ou ranking;
- validação assistiva simulada como substituta de NVDA ou VoiceOver humano;
- alteração dos artefatos `HANDOFF.md` e `verification.json` de U01/#174.

### Critérios de aceite de U02

- topbar, navegação, `.round-instruction`, a região viva e os quatro slots preservam identidade durante um voto;
- `document.activeElement` continua sendo o controle votado e o anel de foco segue visível após a nova rodada;
- um `MutationObserver` registra zero substituições dos nós persistentes;
- existe uma única região `role="status"`, montada vazia, que recebe os três anúncios em ordem;
- testes do repositório, build e `interaction-smoke.mjs` permanecem verdes.

### Human gate de U02

Stefan Cabral precisa confirmar em leitor de tela real o que foi ouvido nos três estados e se o cursor virtual permanece no contexto da rodada. A evidência automática não fecha esse gate.
