# HANDOFF — #176 · piloto de arte de carta

## Status

- Estado: `primeiro lote invalidado; regeneração obrigatória antes de coleta humana`
- Issue: https://github.com/stefancabral-oss/presidencia-duelo/issues/176
- Branch: `icm/12-u05-card-art-pilot-176`
- Base validada: `origin/main` em `8f7ba527`.
- Gate humano: **não iniciado e não autorizado para P01–P08**.

## Entregue

- Registro explícito de que `pilot-2` foi ajustado depois de observar o lote e não o valida retroativamente.
- Oito artes não conformes preservadas sem regeneração, renomeadas `P01.png` a `P08.png` e removidas de `app/public`.
- Manifesto de evidência com hashes SHA-256 das oito artes e das oito referências.
- Fonte, autoria e licença documentadas para as três referências auditadas; `license-pending` explícito para as cinco referências user-edited sem proveniência fotográfica.
- Formulário bloqueado contra coleta e exportação; a prévia técnica reproduz os recortes reais de 390 × 844 e 1000 × 800.
- Smoke que renderiza `app/src/styles.css` e compara sua geometria com o formulário, sem manter uma segunda tabela de dimensões esperadas.
- Schema consolidado sem registros individuais, com supressão de células pequenas, revisão humana de identidade/dignidade e autor/data da decisão.
- Validador semântico executável para cobertura P01–P08, somas, denominadores, taxas, estratos, mínimo de 20 externos por cenário, atestação responsável e bloqueios da decisão `seguir`.
- Verificador pós-build que compara hashes e impede afirmar isolamento sem inspecionar `app/dist`.

## Verificação técnica

- `npm test`: 117/117 aprovados (4 compartilhados, 39 backend, 74 app), incluindo as fixtures negativas do validador semântico.
- `npm run build --prefix app`: aprovado; 157 arquivos do `dist` inspecionados e nenhum hash do piloto empacotado.
- `npm run test:card-art-pilot-form --prefix app`: aprovado em Chromium e WebKit nos dois cenários; geometria canônica igual ao CSS do app e coleta/exportação bloqueadas.
- `npx --yes --package=ajv-cli@5.0.0 --package=ajv-formats@3.0.1 ajv compile -s stages/12_quality_gate_main/references/card-art-pilot-results.schema.json --spec=draft2020 -c ajv-formats`: aprovado; schema Draft 2020-12 válido.
- `git diff --check`: aprovado.

## Proveniência que ainda bloqueia produção

As referências `017`, `019` e `052` têm fonte, autoria e licença documentadas. As referências `001`, `028`, `033`, `063` e `084` vieram de TIFs editados entregues pelo usuário, mas sem origem fotográfica, autoria ou licença comprovadas. A existência de uma fonte editorial anterior para outra fotografia da pessoa não transfere licença ao arquivo substituto.

## Fora deste corte

- Publicar ou servir as artes no jogo.
- Alterar o catálogo ou o portão de elegibilidade.
- Separar o modelo `cardArt`/`profilePhoto`, que só deve ser ativado com a governança editorial da #171.
- Criar resultados hipotéticos, preencher revisões humanas ou declarar o gate aprovado.

## Próximo passo obrigatório

1. Manter `pilot-2` versionado sem adaptá-lo ao resultado futuro.
2. Regularizar ou substituir as cinco referências `license-pending`.
3. Gerar oito imagens novas sob essa regra prévia; P01–P08 atuais não podem ser reaproveitadas.
4. Atualizar manifesto, hashes e formulário, e só então mudar `collectionAllowed` após revisão técnica.
5. Executar o formulário com pelo menos 20 pessoas externas em cada cenário.
6. Validar o consolidado pelo schema e pelo validador semântico, registrar revisores de identidade/dignidade e uma decisão humana assinada na issue #176.
