# Primeiro lote de retratos Chroma

## Decisão de produto

- A carta básica continua sendo a aparência padrão de todas as pessoas.
- As artes deste lote aparecem somente no Laboratório de Chromas da Coleção.
- Nenhuma arte é adicionada ao inventário, sorteio, compra ou equipamento nesta etapa.
- Toda arte deste lote é identificada no card e na acessibilidade como editada por inteligência artificial.

## Conteúdo integrado

- 35 pessoas que já pertencem ao catálogo atual.
- Derivados móveis em JPEG, 600 × 750, qualidade 88, com aproximadamente 4 MB no total.
- Os 35 PNGs mestres em 1200 × 1500 permanecem intactos no pacote de origem fora do app.
- A segunda arte de Flávio Bolsonaro (`002b`, Holofote Dramático) permanece registrada como alternativa e fora do bundle.
- Jair Renan (`126_jair-bolsonaro-filho.png`) permanece fora do app porque não pertence ao catálogo atual de 125 pessoas.

O mapeamento consumido pela interface está em `app/src/approved-chromas.js`. Cada registro conserva o código da pessoa, o look aplicado, o nome do look e o caminho determinístico da imagem.

## Apresentação

- A Coleção mostra seis exemplos inicialmente e oferece a ação `Ver as 35 Chromas`.
- No celular, as cartas aparecem grandes e empilhadas.
- No desktop, aparecem duas por linha.
- Moldura malaquita e ouro, placa de identificação, verniz e holograma são camadas da interface; o retrato aprovado não é retocado novamente.
- O brilho responde ao toque, ponteiro ou inclinação do aparelho, respeitando `prefers-reduced-motion`.

## Critério de revisão humana

A revisão considera o tamanho real de exibição no app. Bloqueiam a publicação: pessoa errada, alteração fisionômica evidente, erro visível em olhos, boca, mãos ou acessórios e mudança radical de idade ou expressão. Diferenças microscópicas percebidas apenas por ampliação ou por medição automática ficam registradas como observação, mas não impedem esta prévia.

## Evidências

- `stages/10_rebuild_eleicoes_2026/output/chroma-approved-batch-mobile-qa.png`
- `stages/10_rebuild_eleicoes_2026/output/chroma-approved-batch-desktop-qa.png`

