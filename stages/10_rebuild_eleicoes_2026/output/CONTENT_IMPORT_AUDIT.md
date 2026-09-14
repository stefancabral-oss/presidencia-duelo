# Gate de importação — perfis e fotografias de 125 pessoas

## Resultado

Os arquivos fecham corretamente no nível de pessoa: 125 nomes no catálogo mestre, 125 perfis e 375 registros fotográficos, exatamente três por pessoa. Não há nomes duplicados, pessoas sem perfil, pessoas sem fotos ou registros externos ao catálogo.

O conteúdo deve permanecer como `draft`. Os perfis podem entrar no pipeline de revisão, mas as fotos ainda não podem ser ativadas automaticamente no app.

## Perfis editoriais

- 125 de 125 perfis possuem todos os campos estruturais esperados.
- Cada perfil possui exatamente três fatos e entre 3 e 5 fontes.
- Média de 4,06 fontes por perfil.
- Todos estão marcados como revisados em `2026-09-13`.
- Todas as URLs de fonte têm formato HTTP(S) válido.
- Uma varredura simples encontrou ao menos uma fonte de domínio oficial em 35 perfis; 90 dependem apenas de fontes secundárias segundo essa lista de domínios. Esse teste não substitui checagem editorial individual.

### Gate editorial

Antes de `published`, cada afirmação atual, realização e controvérsia precisa ter uma referência diretamente compatível. Anulação, absolvição, condenação, investigação, indiciamento, denúncia e processo são estados distintos e não podem ser resumidos como equivalentes.

## Fotografias

- 375 registros, 125 em cada tipo esperado.
- 178 já marcados como compatíveis com 4:5; 179 exigem recorte parcial; 18 não servem diretamente em 4:5.
- 62 arquivos têm uma dimensão inferior a 800 px.
- 4 resoluções não estão em formato numérico utilizável.
- 50 datas não usam `AAAA-MM-DD` e incluem ano isolado, mês isolado ou `desconhecida`.
- 44 retratos neutros têm mais de cinco anos.
- 13 registros possuem licença ou condição que exige revisão jurídica/editorial.
- 54 dos 125 retratos neutros falham em pelo menos um gate automático de recorte, resolução ou licença.
- Nenhuma URL é estruturalmente inválida e nenhuma URL direta está duplicada.

### Gate fotográfico

Uma foto principal só pode ser publicada quando:

1. o recorte 4:5 estiver aprovado;
2. a menor dimensão tiver pelo menos 800 px;
3. a licença permitir o uso planejado e a atribuição estiver registrada;
4. a data estiver normalizada ou explicitamente marcada como desconhecida;
5. a imagem ainda representar a aparência atual da pessoa;
6. o arquivo tiver sido baixado para armazenamento controlado, sem hotlink como dependência de produção.

## Severidade

- **Alta:** 54 retratos principais não estão prontos para importação automática.
- **Alta:** afirmações editoriais atuais ainda não passaram por verificação humana fonte a fonte.
- **Média:** 62 fotos abaixo do piso de resolução e 197 sem recorte 4:5 pronto.
- **Média:** 13 condições de licença precisam de decisão explícita.
- **Baixa:** 50 datas e 4 resoluções precisam de normalização de formato.

## Próxima ação segura

1. Importar os 125 perfis como `draft`, invisíveis ao público.
2. Usar os 71 retratos neutros que passaram no gate apenas no ambiente de teste.
3. Devolver a lista dos 54 retratos prioritários para substituição ou tratamento.
4. Publicar cada pessoa somente depois dos gates editorial e fotográfico.

## Reprodução

```sh
node back/scripts/audit-content-import.mjs \
  stages/10_rebuild_eleicoes_2026/input/polimatch-catalogo-125.json \
  stages/10_rebuild_eleicoes_2026/input/polimatch-perfis-editoriais-125.json \
  stages/10_rebuild_eleicoes_2026/input/polimatch-fotos-catalogo-125.json
```
