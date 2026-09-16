# Evidência — Issue #168

## Faixas e gates

- `320–479`: celular compacto, duelo 2 × 2, gutter de 9 px.
- `480–699`: celular confortável, duelo 2 × 2, gutter de 16 px.
- `700–999`: tablet, duelo 2 × 2 e telas editoriais em coluna larga.
- `1000–1279`: desktop de entrada, duelo 4 × 1 e ranking em duas regiões.
- `1280+`: composição wide com o mesmo teto de shell de 1320 px.

O smoke também exerce as bordas 320/479/480/699/700/999/1000/1279/1280/1920. Em cada viewport ele verifica ausência de overflow horizontal, invariância do shell e da marca nas três telas, número esperado de colunas, cartas fora da navegação, 54 nomes sem corte e aproveitamento do ranking.

## Antes/depois

Na coluna `shell`, a ordem é Início/Duelo/Ranking. A largura da lista e o `y` da primeira linha pertencem ao Ranking.

| Viewport | shell antes → depois | colunas do duelo | lista antes → depois | primeira linha antes → depois |
|---|---:|---:|---:|---:|
| 390 × 844 | 390/390/390 → 390/390/390 | 2 → 2 | 372 → 372 px | 728 → 853 px |
| 700 × 900 | 700/700/700 → 700/700/700 | 4 → 2 | 532 → 660 px | 734 → 736 px |
| 768 × 900 | 768/768/768 → 768/768/768 | 4 → 2 | 532 → 728 px | 734 → 736 px |
| 900 × 900 | 900/900/900 → 900/900/900 | 4 → 2 | 532 → 860 px | 734 → 736 px |
| 1000 × 900 | 920/1000/920 → 1000/1000/1000 | 4 → 4 | 532 → 562 px | 734 → 185 px |
| 1200 × 900 | 920/1200/920 → 1200/1200/1200 | 4 → 4 | 532 → 681 px | 734 → 185 px |
| 1280 × 620 | 920/920/920 → 1280/1280/1280 | 4 → 4 | 532 → 728 px | 734 → 160 px |
| 1440 × 640 | 920/920/920 → 1320/1320/1320 | 4 → 4 | 532 → 753 px | 734 → 160 px |
| 1440 × 900 | 920/1320/920 → 1320/1320/1320 | 4 → 4 | 532 → 753 px | 734 → 185 px |

O deslocamento da primeira linha no celular é consequência do ranking continuar linear nessa faixa; a melhora pretendida é no tablet e, sobretudo, no desktop. Em 1280 × 620 e 1440 × 640, busca e primeira linha passaram de fora do viewport para `y=72/160`, mantendo a visão geral ao lado.

## Artefatos

- Medidas: [`before-metrics.json`](./before-metrics.json) e [`after-metrics.json`](./after-metrics.json).
- Screenshots depois: [`768 × 900`](./after-screenshots/768x900-duel.png), [`1000 × 900`](./after-screenshots/1000x900-ranking.png) e [`1440 × 640`](./after-screenshots/1440x640-ranking.png), com Início/Duelo/Ranking preservados no mesmo diretório.

## Resultado

- shell e marca variam no máximo 1 px entre telas: aprovado;
- overflow horizontal: zero nos 48 cenários;
- nomes cortados: zero em 54 nomes × 16 viewports por navegador;
- cartas cobertas pela navegação: zero;
- Chromium e WebKit: aprovados.
