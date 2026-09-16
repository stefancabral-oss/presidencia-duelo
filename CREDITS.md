# Créditos e proveniência de imagens

O PoliMatch mantém ativos com funções e estados diferentes. Fotografia documental, arte de carta e Chroma não são tratados como se fossem a mesma imagem.

## Fotografias de perfil

As fotografias reais vêm de Wikimedia Commons, páginas institucionais, perfis públicos, veículos de imprensa e lotes entregues pelo curador. Fonte, crédito, licença declarada e checksum dos pacotes de referência estão documentados em:

- `stages/10_rebuild_eleicoes_2026/input/polimatch-fotos-catalogo-125.md`;
- `stages/10_rebuild_eleicoes_2026/output/TREATED_PHOTO_AUDIT.md`;
- `docs/design/USER_EDITED_PHOTOS.md`;
- os campos `sources` de cada perfil em `shared/elections-2026.json`.

Os slots locais atuais ficam em `app/public/portraits/001.jpg` a `125.jpg`. A existência de um arquivo no slot não equivale a aprovação editorial, de identidade ou de licença.

## Arte de carta — piloto da Issue #176

O diretório `app/public/card-art/pilot/` contém oito retratos experimentais gerados com a ferramenta integrada de geração de imagens da OpenAI. Eles usam fotografias locais somente como referência de identidade e seguem o guia `docs/design/CARD_ART_NEUTRALITY_GUIDE.md`.

Esses arquivos:

- têm estado `pilot-not-published`;
- não são servidos pelo catálogo nem substituem fotografias de perfil;
- não foram aprovados para produção;
- dependem de teste cego externo de reconhecimento e neutralidade;
- possuem referência, ferramenta, dimensões e SHA-256 em `app/public/card-art/pilot/manifest.json`.

## Chromas e artes editadas

As prévias em `app/public/chromas/` são ativos separados das fotografias documentais e da arte básica da carta. Quando uma arte tiver edição ou geração assistida por IA, essa condição deve ser informada na interface e em seu manifesto. Raridade, brilho ou acabamento não representam julgamento sobre a pessoa retratada.

## Independência

O projeto não é afiliado a partidos, candidaturas, TSE, Wikimedia, OpenAI ou às pessoas retratadas. A presença de uma imagem no repositório não representa apoio, oposição nem aprovação para publicação.
