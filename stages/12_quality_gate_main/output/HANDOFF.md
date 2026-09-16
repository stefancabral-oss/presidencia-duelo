# HANDOFF — ICM 12 · U03

## Status

- Estado: `implementação, CI e human gate aprovados; pronta para merge`
- Issue: https://github.com/stefancabral-oss/presidencia-duelo/issues/168
- Macro: https://github.com/stefancabral-oss/presidencia-duelo/issues/175
- Branch: `icm/12-u03-responsive-168`
- Base: `main@3dfd4b4`
- PR: https://github.com/stefancabral-oss/presidencia-duelo/pull/187

## Entregue

- Cinco faixas contíguas de largura, de 320 px a 1920 px e além, com responsabilidade explícita.
- Um único `--shell-max` e gutter por faixa para Início, Duelo e Ranking.
- Duelo 2 × 2 em celular/tablet e 4 × 1 em desktop/wide, preservando a anatomia da #165.
- Refinamento comum para janelas desktop largas e baixas, sem condicionar o shell à tela ativa.
- Ranking reorganizado em visão geral e resultados, lado a lado a partir de 1000 px.
- Gate Playwright próprio cobrindo 3 telas, 16 viewports, 54 nomes e geometria do shell.
- Gate responsivo integrado ao workflow de Chromium e WebKit.
- Screenshots e JSON de métricas antes/depois em `references/issue-168/`.

## Fora desta unidade

- Feedback da rodada baseado no jogador: #169.
- Controle separado para abrir perfil: #167.
- Qualquer mudança de backend, catálogo, autenticação ou deploy.

## Validação local

- `npm test`: 67/67 (4 shared, 17 back, 46 app).
- `npm run build --prefix app`: aprovado; 99/125 slots de retrato presentes.
- `interaction-smoke.mjs`: aprovado em Chromium e WebKit.
- `vote-recovery.mjs`: aprovado em Chromium e WebKit.
- `responsive-layout.mjs`: 3 telas × 16 viewports aprovados em Chromium e WebKit.
- Viewports de limite: 320, 479, 480, 699, 700, 999, 1000, 1279, 1280 e 1920 px.
- Viewports de evidência: 390 × 844, 700/768/900/1000/1200 × 900, 1280 × 620, 1440 × 640 e 1440 × 900.
- 54/54 nomes medidos em cada viewport do duelo; zero truncamento.
- Design Validator automático: aprovado no run [35056992263](https://github.com/stefancabral-oss/presidencia-duelo/actions/runs/35056992263).
- UI Interaction Smoke automático: Chromium e WebKit aprovados no run [35056992253](https://github.com/stefancabral-oss/presidencia-duelo/actions/runs/35056992253).

## Riscos conhecidos

- O ranking móvel continua naturalmente longo; a otimização desta unidade prioriza a largura em tablets e a visualização imediata da lista em desktop.
- O teto do shell é 1320 px; acima disso a composição centraliza sem esticar indefinidamente textos e cartas.

## Próximo passo exato

1. Confirmar os checks automáticos do head documental final.
2. Mesclar com a autorização permanente do human gate.
3. Iniciar #169 somente a partir da nova `main`.

## Human gate

- Decisão: `autorização permanente concedida para merge quando isolada e verde`
- Responsável: Stefan Cabral
- Observação: não usar essa autorização para misturar a #169.
