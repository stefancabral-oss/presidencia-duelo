# ICM 17 — Conheça seu candidato e Notícias

## Objetivo

Decompor o épico [#206](https://github.com/stefancabral-oss/presidencia-duelo/issues/206) em três frentes, com guias agente.md e microissues executáveis. A solicitação atual é criar o planejamento e os artefatos no repositório/GitHub.

## Entradas

- Especificação e oito rodadas documentais de saturação da issue #206, preservadas em references/epico-206.md.
- AGENTS.md e CONTEXT.md da raiz; arquitetura Vite/JavaScript em app/, API em back/ e contratos em shared/.
- Requisitos de publicação/proveniência #171/#173, acessibilidade #166/#167, fotografias #202 e ilustrações adiadas #176.
- Consolidação #205, cuja integração deve ser coordenada antes da implementação desta expansão.

## Escopo desta entrega documental

- Back #207: sete microissues de dados, importação, contratos, APIs e operação.
- Front #208: seis microissues de componentes, telas e revisão editorial em app/.
- App #209: cinco microissues de shell, integração, PWA, validação e lançamento.
- Hierarquia nativa de subissues, guias por frente, roteiro individual em Markdown, mapa de dependências e critérios de aceite.
- A base de planejamento é main 8d7a46db4c5eceb3179cf0add0ba6634397d1c66. Não pressupor que a PR #205 está mesclada.

## Fronteiras

Front é uma responsabilidade de apresentação, não um segundo diretório de produto. App integra essas telas no Vite/PWA existente. Back publica contratos e dados. B01 define contrato inicial e fixtures; telas e shell podem avançar contra esse contrato sem aguardar toda a API, respeitando os gates aplicáveis.

Todos os dados eleitorais oficiais do recorte fazem parte do diretório, independentemente da presença da pessoa no jogo ou de ter fotografia. Senado inclui dois suplentes; Executivo inclui vice. A composição é temporal. Notícias preservam três espaços de cobertura e mostram lacunas; orientação editorial, origem internacional e tipo de conteúdo são dimensões distintas.

## Dependências e início da implementação

O README e o manifest.json registram o grafo entre microissues. A ordenação não substitui aceite: o próximo executor verifica evidências e gates das dependências. A criação antecipada de um backlog foi solicitada pelo usuário e não declara etapas dependentes concluídas.

## Aceite da entrega atual

- [x] Três issues principais e dezoito microissues abertas e vinculadas corretamente.
- [x] Três agente.md e dezoito Markdown individuais publicados na PR documental #228.
- [x] Dependências sem ciclos, referências resolvidas e responsabilidades sem duplicação de frontend.
- [x] HANDOFF e verification.json distinguem planejamento entregue de implementação, testes de produto, aprovação humana e deploy pendentes.

## Fora de escopo desta entrega

Código de produto, dados eleitorais novos publicados, automações agendadas, contratação de provedores, aprovação editorial, merge de PRs existentes ou deploy.

## Gate humano do produto futuro

Permanece pendente. O responsável de produto/editorial valida protótipo, amostras, metodologia das fontes e piloto real; leitores de tela/usabilidade exigem evidências reais. Um agente não aprova seu próprio gate.
