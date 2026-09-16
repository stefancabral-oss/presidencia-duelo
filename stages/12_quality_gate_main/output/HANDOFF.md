# HANDOFF — ICM 12 · U04

## Status

- Estado: `implementação e validação local aprovadas; CI remoto pendente`
- Issue: https://github.com/stefancabral-oss/presidencia-duelo/issues/169
- Macro: https://github.com/stefancabral-oss/presidencia-duelo/issues/175
- Branch: `icm/12-u04-feedback-169`
- Base: `main@86d2659`
- PR: pendente

## Entregue

- Contrato de rodada com `personalFeedback` obrigatório e `globalEvent` opcional e secundário.
- Ranking pessoal baseado em maioria das comparações diretas, condensado por componentes fortemente conexos.
- Política declarada `pairwise-majority-scc-v1`, com empates honestos para ciclos e preferências ainda não resolvidas.
- Elo, vitórias e derrotas mantidos como contexto visual, sem decidir a posição pessoal.
- Feedback visual e acessível na ordem `No seu ranking` → `No placar do público`.
- Migração aditiva do PostgreSQL e recuperação idempotente segura para rodadas novas e legadas.
- Regressão automatizada do caso medido de 35 rodadas.
- Evidência visual com canal pessoal isolado, dois canais e ranking pessoal.

## Fora desta unidade

- Rate limit, identificação pública e fechamento de CORS: #170.
- Controle separado para abrir perfil: #167.
- Qualquer mudança de catálogo, autenticação ou deploy que não seja exigida pelo contrato da rodada.

## Validação local

- `npm test --prefix back`: 27/27.
- `npm test --prefix app`: 49/49.
- `npm run build --prefix app`: aprovado; 99/125 slots de retrato presentes.
- `interaction-smoke.mjs`: canais pessoal + público e somente pessoal aprovados em Chromium; os dois canais aprovados em WebKit.
- `responsive-layout.mjs`: 3 telas × 16 viewports aprovados em Chromium e WebKit.
- `vote-recovery.mjs`: aprovado em Chromium e WebKit.
- Integração PostgreSQL: coberta pelo smoke atualizado e pendente do runner PostgreSQL 16 do CI; Docker/PostgreSQL não estão disponíveis no ambiente local.

## Evidência

- Contrato, política e regressão: `references/issue-169/EVIDENCE.md`.
- `references/issue-169/feedback-personal-390x844.png`.
- `references/issue-169/feedback-both-390x844.png`.
- `references/issue-169/personal-ranking-390x844.png`.

## Riscos conhecidos

- Preferências desconectadas ficam empatadas até o jogador comparar os respectivos grupos. Isso é comportamento deliberado, não uma lacuna preenchida por Elo.
- Rodadas gravadas antes desta unidade não possuem snapshot pessoal recuperável; no replay, o produto mostra feedback pessoal neutro e expõe o fato global antigo apenas como evento público.

## Próximo passo exato

1. Abrir a PR isolada com `Closes #169`.
2. Aguardar testes de back, integração PostgreSQL, design e interação em Chromium/WebKit.
3. Registrar os links dos runs, mesclar com a autorização permanente e iniciar #170 somente a partir da nova `main`.

## Human gate

- Decisão: `autorização permanente concedida para merge quando isolada e verde`
- Responsável: Stefan Cabral
- Observação: não usar essa autorização para misturar a #170.
