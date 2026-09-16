# [ICM 12] Portão de qualidade da `main`

## Objetivo

Fazer cada mudança chegar à `main` com evidência automática da camada que ela altera, sem misturar unidades independentes.

## Macro e unidade ativa

- Macro: [#175 — Portão de qualidade para main](https://github.com/stefancabral-oss/presidencia-duelo/issues/175).
- Unidade concluída: `U01`, [#174 — cobertura de CI para `back/` e `shared/`](https://github.com/stefancabral-oss/presidencia-duelo/issues/174), integrada pela PR #185.
- Unidade ativa: `U02`, [#165 — hierarquia de informação da carta](https://github.com/stefancabral-oss/presidencia-duelo/issues/165).
- Próxima unidade: [#168 — sistema responsivo por comportamento](https://github.com/stefancabral-oss/presidencia-duelo/issues/168), somente depois do gate de U02.

## Escopo de U02

- reconstruir a anatomia móvel da carta em 390 × 844 usando o espaço vertical ocioso;
- manter retrato dominante e criar uma placa de porcelana própria para nome, raridade, partido/área e função;
- eliminar texto funcional abaixo de 11 px;
- impedir corte de glifos em todos os nomes jogáveis;
- restaurar a semântica verde/vermelha de ganho e perda sem `!important`;
- registrar screenshots e medidas de `getComputedStyle` antes/depois.

## Exclusões de U02

- não redesenhar os breakpoints gerais, o shell ou o ranking da #168;
- não criar o controle de acesso ao perfil da #167;
- não alterar backend, autenticação, catálogo, áudio ou deploy;
- não misturar qualquer outra issue do portão de qualidade.

## Dependência resolvida

U01 foi integrada à `main` como `9cf11af`. U02 nasceu diretamente desse commit, em branch e worktree próprios.

## Critérios de aceite

- carta móvel próxima de 185 × 280 px, com quatro cartas e navegação no primeiro viewport de 390 × 844;
- nenhum texto funcional da carta abaixo de 11 px;
- os 54 nomes jogáveis medidos sem `scrollHeight > clientHeight`;
- ganho e perda com cores distintas em Chromium e WebKit;
- evidência antes/depois e métricas versionadas;
- smokes existentes de 320 × 568, desktop e iMac continuam aprovados.

## Human gate

Stefan autorizou a integração automática das unidades que estiverem isoladas, revisadas, testadas e com CI verde. Essa autorização não substitui os gates técnicos nem permite empilhar #168 nesta PR.
