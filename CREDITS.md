# Créditos e proveniência de imagens

O PoliMatch mantém ativos com funções e estados diferentes. Fotografia documental, arte de carta e Chroma não são tratados como se fossem a mesma imagem.

## Fotografias de perfil

Em 17/09/2026 o responsável pelo produto autorizou restaurar as fotografias existentes nas cartas e adiar as ilustrações (issue #202). O conjunto de 54 nomes e arquivos está fixado, com SHA-256, em `shared/photo-recovery-manifest.json`. Essa restauração não resolve pendências de origem ou licença nem aprova os textos dos perfis. Durante a recuperação, alegações biográficas e classificações pendentes não são publicadas.

As fotografias reais vêm de Wikimedia Commons, páginas institucionais, perfis públicos, veículos de imprensa e lotes entregues pelo curador. Fonte, crédito, licença declarada e checksum dos pacotes de referência estão documentados em:

- `stages/10_rebuild_eleicoes_2026/input/polimatch-fotos-catalogo-125.md`;
- `stages/10_rebuild_eleicoes_2026/output/TREATED_PHOTO_AUDIT.md`;
- `docs/design/USER_EDITED_PHOTOS.md`;
- os campos `sources` de cada perfil em `shared/elections-2026.json`.

Os slots locais atuais ficam em `app/public/portraits/001.jpg` a `125.jpg`. A existência de um arquivo no slot não equivale a aprovação editorial, de identidade ou de licença.

## Arte de carta — piloto da Issue #176

O diretório de evidência `stages/12_quality_gate_main/evidence/card-art-pilot-176/` contém oito retratos sintéticos experimentais gerados com a ferramenta integrada de geração de imagens da OpenAI. Eles usam fotografias locais somente como referência de identidade. O lote foi invalidado porque o guia `pilot-2` foi ajustado depois de as imagens serem observadas; ele não comprova conformidade com uma regra prévia.

Esses arquivos:

- têm estado `pilot-invalidated-regeneration-required` no manifesto;
- ficam fora de `app/public`, não são servidos pelo catálogo e não substituem fotografias de perfil;
- são verificados depois de cada build para garantir que nenhum dos oito hashes entre em `app/dist`;
- não foram aprovados para produção;
- não podem ser usados em coleta humana nem sustentar uma decisão `seguir`;
- precisam ser substituídos por um lote novo gerado sob o guia já versionado antes de qualquer teste cego;
- possuem referência, ferramenta, dimensões e SHA-256 da arte e da referência no manifesto de evidência.

As referências de João Campos (`017`), Douglas Ruas (`019`) e Sônia Guajajara (`052`) mantêm fonte fotográfica, autoria e licença documentadas no catálogo auditado. As referências de Lula (`001`), Michelle Bolsonaro (`028`), Marina Silva (`033`), Jair Bolsonaro (`063`) e Tabata Amaral (`084`) vieram de arquivos editados entregues pelo usuário; o arquivo recebido é conhecido, mas a origem fotográfica, a autoria e a licença não estão documentadas. Por isso, essas cinco estão marcadas `license-pending`. As fontes editoriais listadas anteriormente para outras fotografias dessas pessoas não são apresentadas como licença dos arquivos substitutos.

Essas artes têm aparência fotográfica, mas são sintéticas. Qualquer uso futuro precisa exibir `Retrato sintético gerado por IA` junto da imagem e preservar a fotografia documental como ativo separado.

## Chromas e artes editadas

As prévias em `app/public/chromas/` são ativos separados das fotografias documentais e da arte básica da carta. Quando uma arte tiver edição ou geração assistida por IA, essa condição deve ser informada na interface e em seu manifesto. Raridade, brilho ou acabamento não representam julgamento sobre a pessoa retratada.

## Independência

O projeto não é afiliado a partidos, candidaturas, TSE, Wikimedia, OpenAI ou às pessoas retratadas. A presença de uma imagem no repositório não representa apoio, oposição nem aprovação para publicação.
