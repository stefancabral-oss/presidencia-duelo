# HANDOFF — ICM 12 · U02

## Status

- Estado: `implementação e validação local aprovadas; CI final pendente`
- Issue: https://github.com/stefancabral-oss/presidencia-duelo/issues/165
- Macro: https://github.com/stefancabral-oss/presidencia-duelo/issues/175
- Branch: `icm/12-u02-card-hierarchy-165`
- Base: `main@9cf11af`
- PR: https://github.com/stefancabral-oss/presidencia-duelo/pull/186

## Entregue

- Carta móvel ampliada de 246 para 280 px com o espaço ocioso existente.
- Retrato e placa de porcelana separados, sem overlay escuro sobre a identidade.
- Nome e raridade na primeira linha; partido/área e função abaixo.
- Resumo redundante retirado da carta básica e preservado no perfil detalhado.
- Nome em 15/18 px, metadados em 11/14 px e resultado em 12/14 + 11/14 px.
- Marca textual microscópica retirada da carta móvel em favor do símbolo oficial.
- Ganho verde e perda vermelha restaurados sem `!important`.
- Smoke comportamental cobrindo geometria, tipografia, 54 nomes, pending, gain e loss.
- Screenshots e JSON de métricas antes/depois em `references/issue-165/`.

## Fora desta unidade

- Sistema geral de breakpoints e composição das demais telas: #168.
- Controle separado para abrir perfil: #167.
- Qualquer mudança de backend, catálogo, autenticação ou deploy.

## Validação local

- `npm test --prefix app`: 46/46.
- `npm run build --prefix app`: aprovado; 99/125 slots de retrato presentes.
- `interaction-smoke.mjs` em Chromium: aprovado.
- `interaction-smoke.mjs` em WebKit: aprovado.
- Viewports preservados pelo smoke: 320 × 568, 390 × 844, 1280 × 900 e 1440 × 900.
- 54/54 nomes medidos; zero corte por `scrollHeight > clientHeight`.

## Riscos conhecidos

- A issue citava 17 nomes com descendentes; o conjunto aprovado atual contém 16 ocorrências literais de `[gjpqyç]`. A validação percorre os 54 nomes para ser mais forte que a contagem histórica.
- A reorganização geral de faixas responsivas permanece deliberadamente fora desta unidade.

## Próximo passo exato

1. Abrir a PR isolada da #165.
2. Confirmar todos os checks automáticos no head final.
3. Mesclar com a autorização permanente do human gate.
4. Iniciar #168 somente a partir da nova `main`.

## Human gate

- Decisão: `autorização permanente concedida para merge quando isolada e verde`
- Responsável: Stefan Cabral
- Observação: não usar essa autorização para misturar a #168.
