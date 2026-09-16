# [ICM 12] Portão de qualidade da `main`

## Objetivo

Fazer cada mudança chegar à `main` com evidência automática da camada que ela altera, sem misturar unidades independentes.

## Macro e unidade ativa

- Macro: [#175 — Portão de qualidade para main](https://github.com/stefancabral-oss/presidencia-duelo/issues/175).
- Unidades concluídas: `U01`, [#174 — cobertura de CI para `back/` e `shared/`](https://github.com/stefancabral-oss/presidencia-duelo/issues/174), integrada pela PR #185; e `U02`, [#165 — hierarquia de informação da carta](https://github.com/stefancabral-oss/presidencia-duelo/issues/165), integrada pela PR #186.
- Unidade ativa: `U03`, [#168 — sistema responsivo por comportamento](https://github.com/stefancabral-oss/presidencia-duelo/issues/168).
- Próxima unidade: [#169 — feedback da rodada pessoal](https://github.com/stefancabral-oss/presidencia-duelo/issues/169), somente depois do gate de U03.

## Escopo de U03

- declarar faixas contíguas para celular compacto, celular confortável, tablet, desktop e wide;
- fazer `.app-shell`, `.topbar` e marca manterem a mesma geometria em Início, Duelo e Ranking;
- assumir o intervalo 700–999 px com um duelo 2 × 2 próprio, sem herdar o desktop por acidente;
- manter quatro cartas em uma fileira a partir de 1000 px e tratar janelas largas e baixas sem esconder a ação;
- usar duas regiões no ranking desktop, deixando visão geral à esquerda e busca/lista à direita;
- automatizar medidas e screenshots responsivos em Chromium e WebKit.

## Exclusões de U03

- não alterar a hierarquia interna da carta aprovada na #165;
- não implementar o feedback pessoal da #169;
- não alterar backend, autenticação, catálogo, áudio ou deploy;
- não misturar qualquer outra issue do portão de qualidade.

## Dependência resolvida

U02 foi integrada à `main` como `3dfd4b4`. U03 nasceu diretamente desse commit, em branch e worktree próprios.

## Critérios de aceite

- faixas 320–479, 480–699, 700–999, 1000–1279 e 1280+ declaradas sem buracos;
- shell e marca invariantes entre as três telas em cada viewport;
- duelo 2 × 2 abaixo de 1000 px e 4 × 1 a partir de 1000 px;
- zero overflow horizontal ou nome cortado nos 16 viewports automatizados;
- ranking em coluna larga no tablet e em duas regiões a partir de 1000 px;
- busca e primeira linha do ranking visíveis nas janelas 1280 × 620 e 1440 × 640;
- tabela antes/depois e evidência visual versionadas.

## Human gate

Stefan autorizou a integração automática das unidades que estiverem isoladas, revisadas, testadas e com CI verde. Essa autorização não substitui os gates técnicos nem permite empilhar #169 nesta PR.
