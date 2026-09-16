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
- Validador executável que aplica o schema Draft 2020-12 antes da semântica, rejeita propriedades extras e PII aninhada, exige autoria/data/conteúdo das revisões e decisão, cobertura P01–P08, somas, taxas, estratos e pelo menos 20 respostas válidas externas por combinação arte × cenário.
- Resultado vinculado ao lote pelo SHA-256 da serialização canônica do manifesto completo; mudança de status, estilo, pessoa, arquivo, hash, referência ou licença invalida replay.
- Gate que recusa qualquer consolidado enquanto `collectionAllowed` não for `true`, exige hashes e proveniência completa e, para `seguir`, limita favorecimento/prejuízo a 20% no total e por cenário e diferença de reconhecimento a 15 pontos percentuais.
- Verificador pós-build que compara hashes e impede afirmar isolamento sem inspecionar `app/dist`; o contexto Docker exclui as artes e fornece somente o manifesto ao estágio de build.
- Workflows com gatilhos para app, shared, `.dockerignore`, créditos, guia, protocolo, resultado, schema, manifesto e evidências; o contrato, o isolamento e o smoke Chromium/WebKit passam a ser checks de CI.

## Verificação técnica

- `npm test`: 138/138 aprovados (4 compartilhados, 39 backend, 95 app), incluindo os payloads negativos que antes burlavam schema, PII, autoria, cronologia, vínculo do lote, neutralidade, reconhecimento, invalidação e denominadores.
- `npm run build --prefix app`: aprovado; 157 arquivos do `dist` inspecionados e nenhum hash do piloto empacotado.
- `npm run test:card-art-pilot-form --prefix app`: aprovado em Chromium e WebKit nos dois cenários; geometria canônica igual ao CSS do app e coleta/exportação bloqueadas.
- `npm run test:card-art-pilot-contract --prefix app`: 33/33 aprovados; Ajv 8.20.0 e ajv-formats 3.0.1 lockados validam a instância Draft 2020-12 antes da semântica, além do contrato do contexto Docker.
- `npm audit --prefix app`: zero vulnerabilidades após travar Ajv 8.20.0 e Playwright 1.55.1.
- `docker build -f app/Dockerfile .`: não executado localmente porque o binário Docker não está instalado neste ambiente; o teste automatizado confirma estaticamente o `COPY` a partir do contexto-raiz, sua ordem antes do build, o `.dockerignore` que exclui as artes e readmite só o manifesto, e que o manifesto não entra no estágio final nginx. O mesmo build real é obrigatório no runner Ubuntu de `design-validator.yml`; seu resultado remoto ainda não foi observado nesta branch sem push/PR.
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
5. Executar o formulário até obter pelo menos 20 respostas válidas externas para cada uma das oito artes em cada cenário.
6. Calcular `batch.manifestSha256`, validar o consolidado pelo schema e pelo validador semântico, registrar revisores de identidade/dignidade e uma decisão humana assinada na issue #176.
