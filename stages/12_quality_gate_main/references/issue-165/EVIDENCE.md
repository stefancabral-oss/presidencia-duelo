# Evidência — Issue #165

## Comparação visual em 390 × 844

- Antes: [`before-390x844.png`](./before-390x844.png)
- Depois: [`after-390x844.png`](./after-390x844.png)
- Resultado antes: [`before-outcome-390x844.png`](./before-outcome-390x844.png)
- Resultado depois: [`after-outcome-390x844.png`](./after-outcome-390x844.png)
- Controle desktop: [`after-desktop-1440x900.png`](./after-desktop-1440x900.png)
- Medidas completas: [`before-metrics.json`](./before-metrics.json) e [`after-metrics.json`](./after-metrics.json)

## Hierarquia e espaço

| Medida | Antes | Depois |
|---|---:|---:|
| carta | 184,5 × 246 px | 184,5 × 280 px |
| retrato | 170,5 × 232 px, sob overlay | 170,5 × 167 px, região própria |
| placa de informação | 170,5 × 76 px, overlay escuro | 170,5 × 100 px, porcelana |
| nome | 13,455 / 13,724 px | 15 / 18 px |
| partido/área | 7,84 px | 11 / 14 px |
| função | 7,36 / 7,949 px, 1 linha | 11 / 14 px, até 2 linhas |
| marca textual | 6,24 px | oculta; símbolo oficial de 18 px |
| espaço entre troca e navegação | 89,875 px | 21,875 px |
| altura do documento | 844 px | 844 px |

O retrato ocupa 62,3% da área interna da carta. As quatro cartas, o botão de troca e a navegação permanecem dentro do primeiro viewport.

## Nomes com descendentes no catálogo aprovado atual

A issue registrou 17 ocorrências. O catálogo aprovado no head desta unidade contém 16 nomes que casam literalmente com `[gjpqyç]` em minúsculas. Para não depender dessa contagem, o smoke renderiza e mede os **54 nomes jogáveis**; nenhum terminou com `scrollHeight > clientHeight`.

| Nome | font-size | line-height | clientHeight | scrollHeight |
|---|---:|---:|---:|---:|
| Augusto Cury | 15px | 18px | 38 | 38 |
| Pablo Marçal | 15px | 18px | 38 | 38 |
| Hugo Motta | 15px | 18px | 38 | 38 |
| Lindbergh Farias | 15px | 18px | 38 | 38 |
| Janja | 15px | 18px | 38 | 38 |
| André Mendonça | 15px | 18px | 38 | 38 |
| Rodrigo Pacheco | 15px | 18px | 38 | 38 |
| Rogério Marinho | 15px | 18px | 38 | 38 |
| Kim Kataguiri | 15px | 18px | 38 | 38 |
| Glauber Braga | 15px | 18px | 38 | 38 |
| Sérgio Moro | 15px | 18px | 38 | 38 |
| Deltan Dallagnol | 15px | 18px | 38 | 38 |
| Neymar Jr. | 15px | 18px | 38 | 38 |
| Popó | 15px | 18px | 38 | 38 |
| Bruno Gagliasso | 15px | 18px | 38 | 38 |
| Gracyanne Barbosa | 15px | 18px | 38 | 38 |

## Estados

| Estado | Nome | Função | Resultado | Cor |
|---|---:|---:|---:|---|
| default | 15 px | 11 px | — | tinta malaquita |
| pending | 15 px | 11 px | — | seleção preservada |
| gain | 15 px | — | 12 px + 11 px | `rgb(7, 95, 69)` |
| loss | 15 px | — | 12 px + 11 px | `rgb(141, 51, 45)` |

Os estados de ganho e perda voltaram a usar cores distintas, além dos sinais `+` e `-`, sem `!important` nas regras de resultado. O mesmo gate foi exercitado novamente em 1440 × 900.
