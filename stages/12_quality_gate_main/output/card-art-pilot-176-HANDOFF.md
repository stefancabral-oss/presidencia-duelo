# HANDOFF — #176 · piloto de arte de carta

## Status

- Estado: `lote de oito isolado como evidência; teste humano e cinco licenças de referência pendentes`
- Issue: https://github.com/stefancabral-oss/presidencia-duelo/issues/176
- Branch: `icm/12-u05-card-art-pilot-176`
- Gate humano: **não aprovado**.

## Entregue

- Guia de neutralidade com tolerância de fundo alinhada ao lote observado e disclosure obrigatório de retrato sintético.
- Oito artes preservadas sem regeneração, renomeadas `P01.png` a `P08.png` e removidas de `app/public`.
- Manifesto de evidência com hashes SHA-256 das oito artes e das oito referências.
- Fonte, autoria e licença documentadas para as três referências auditadas; `license-pending` explícito para as cinco referências user-edited sem proveniência fotográfica.
- Formulário offline com ordem aleatória, caminho cego e dois recortes efetivos de carta: 390 × 844 e 1000 × 800.
- Familiaridade e macrorregião somente na etapa final, depois do disclosure de IA.
- Schema consolidado sem registros individuais, com supressão de células pequenas, revisão humana de identidade/dignidade e autor/data da decisão.
- Verificador pós-build que compara hashes e impede afirmar isolamento sem inspecionar `app/dist`.

## Verificação técnica

- `npm test`: 84/84 testes aprovados (4 compartilhados, 28 do backend e 52 do app).
- `npm run build --prefix app`: aprovado; 156 arquivos do `dist` inspecionados e nenhum hash do piloto empacotado.
- `npm run test:card-art-pilot-form --prefix app`: aprovado em Chromium nos dois cenários, com dimensões, cegamento e sequência final validados.
- `npx --yes --package=ajv-cli@5.0.0 --package=ajv-formats@3.0.1 ajv compile -s stages/12_quality_gate_main/references/card-art-pilot-results.schema.json --spec=draft2020 -c ajv-formats`: schema Draft 2020-12 válido.
- `git diff --check`: aprovado.

## Proveniência que ainda bloqueia produção

As referências `017`, `019` e `052` têm fonte, autoria e licença documentadas. As referências `001`, `028`, `033`, `063` e `084` vieram de TIFs editados entregues pelo usuário, mas sem origem fotográfica, autoria ou licença comprovadas. A existência de uma fonte editorial anterior para outra fotografia da pessoa não transfere licença ao arquivo substituto.

## Fora deste corte

- Publicar ou servir as artes no jogo.
- Alterar o catálogo ou o portão de elegibilidade.
- Separar o modelo `cardArt`/`profilePhoto`, que só deve ser ativado com a governança editorial da #171.
- Criar resultados hipotéticos, preencher revisões humanas ou declarar o gate aprovado.

## Próximo passo humano

1. Regularizar ou substituir as cinco referências `license-pending`.
2. Executar o formulário com pelo menos 20 pessoas externas em cada cenário, usando os parâmetros explícitos.
3. Consolidar sem dados individuais conforme `card-art-pilot-results.schema.json`.
4. Registrar revisores de identidade e dignidade e uma decisão humana assinada na issue #176.
