# Taxonomia editorial do catálogo

## Fonte de verdade

O catálogo estruturado é editado em duas fontes complementares:

- `stages/10_rebuild_eleicoes_2026/input/polimatch-perfis-editoriais-125.json`: nome, cargo/função e conteúdo editorial;
- `stages/10_rebuild_eleicoes_2026/input/polimatch-taxonomia-125.json`: partido, área principal, contexto/afiliação e proveniência por atributo.

`shared/elections-2026.json` é artefato gerado. Nunca deve ser corrigido isoladamente.

Os ponteiros de fonte usados na proveniência significam:

| Ponteiro | Campo editorial |
|---|---|
| `profile.currentOccupation` | `ocupacao_atual` do perfil |
| `profile.partyOrArea` | legado `partido_ou_area`, usado somente como evidência de migração |
| `master.group` | `grupo` do catálogo mestre |
| `master.area` | `area` do catálogo mestre |

## Campos estruturados

| Campo | Contrato | Uso no produto e no Espelho |
|---|---|---|
| `role` | Prosa descritiva de cargo/função, copiada de `ocupacao_atual`; nunca partido ou área. | Explica quem é a pessoa; não participa de filtro taxonômico. |
| `party` | Uma sigla canônica do vocabulário abaixo ou `null`. | Chip partidário, busca, filtro e futura leitura de diversidade partidária. |
| `primaryArea` | Um único valor do vocabulário fechado abaixo ou `null`. | Chip quando não há partido, busca, filtro e futura leitura de áreas escolhidas. |
| `contextAffiliation` | Prosa opcional e não filtrável; organização, contexto institucional ou vínculo explicitamente registrado. | Somente perfil e explicações editoriais; nunca ocupa o slot de partido. |
| `taxonomyProvenance` | Objeto com uma entrada para cada campo acima. | Permite ao Espelho distinguir dado observado, interpretação editorial e lacuna. |

O Espelho pode contar escolhas por partido e área porque esses dois eixos são fechados. Não deve produzir eixo ideológico, situação/oposição, gênero, idade ou região a partir desta taxonomia: esses atributos não foram pesquisados nesta unidade.

## Proveniência por atributo

Cada item em `taxonomyProvenance` tem `status` e `source`:

- `extracted`: o valor aparece explicitamente no campo apontado;
- `inferred`: o valor é uma classificação editorial sustentada pelos campos apontados, sem inventar um fato novo;
- `ambiguous`: a evidência disponível não sustenta um valor único.

`ambiguous` exige valor `null`. Ausência de evidência nunca significa “sem partido” ou “sem vínculo”; significa apenas que o catálogo não pode afirmar o valor.

## Vocabulário de partido

`AVANTE`, `MDB`, `MISSÃO`, `NOVO`, `PDT`, `PL`, `PP`, `PRTB`, `PSB`, `PSD`, `PSDB`, `PSOL`, `PT`, `REDE`, `REPUBLICANOS`, `UNIÃO`.

Somente siglas canônicas entram em `party`. Textos como `PT / Executivo`, `Judiciário / STF`, `Economia / órbita PL` e `Novo / direita` são inválidos nesse campo.

## Vocabulário de área principal

- Audiovisual e artes cênicas
- Comunicação digital
- Economia
- Esporte
- Humor
- Justiça
- Mídia e jornalismo
- Música
- Política institucional
- Religião
- Saúde e bem-estar

É uma classificação principal para navegação e síntese, não uma afirmação de exclusividade profissional.

## Estado editorial da migração

Os 125 registros possuem `role`, `primaryArea` e proveniência completa. O catálogo preserva lacunas em vez de preenchê-las por plausibilidade:

- `party`: 85 valores extraídos e 40 valores ambíguos/nulos;
- `primaryArea`: 47 valores extraídos e 78 inferidos;
- `contextAffiliation`: 23 valores extraídos e 102 ambíguos/nulos.

Antonia Fontenelle é o caso de regressão: `role` vem de `ocupacao_atual`, `party` é `PSDB` e `primaryArea` é `Comunicação digital`.

## Validação e regeneração

```sh
npm run build:catalog --prefix back
npm run test:shared
```

O mesmo validador é chamado pelo gerador, pelo teste compartilhado e pelo workflow `Backend and Shared`. Ele falha para:

- partido fora do vocabulário ou prosa no slot de sigla;
- área fora do vocabulário;
- partido/área vazando para `role`;
- atributo sem proveniência ou fonte;
- valor preenchido com status `ambiguous`;
- artefato gerado divergente da fonte editorial.
