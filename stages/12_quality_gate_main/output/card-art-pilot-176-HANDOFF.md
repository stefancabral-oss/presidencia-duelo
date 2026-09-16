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
- Formulário bloqueado contra coleta e exportação; a prévia técnica reproduz os recortes reais de 390 × 844 e 1000 × 800. Um lote futuro só abre o formulário com `collectionAllowed`, identidade completa e nonce cujo hash pertença ao registro pré-emitido; `scaleDecisionAllowed` não participa desse gate.
- Identidade imutável do lote embutida no formulário e em cada exportação individual: versão, SHA-256 canônico do manifesto e os oito hashes de arte; o smoke compara esse objeto congelado ao manifesto commitado.
- Schemas Draft 2020-12 para resposta individual, bundle não vazio, registro de receipts, plano/receipt de geração e consolidado. O preflight recusa payload legado, array solto, bundle vazio, fingerprint antigo, lotes misturados, código cego ausente/repetido, geometria falsa, receipt desconhecido/reutilizado e resposta duplicada.
- Smoke que renderiza `app/src/styles.css` e compara sua geometria com o formulário; o contrato semântico valida largura e altura de viewport, carta, janela, imagem e placa com tolerância de 0,2 CSS px, além de `object-fit`/posição.
- Schema consolidado sem respostas individuais, com supressão de células pequenas, revisão humana de identidade/dignidade, autor/data da decisão e custódia obrigatória do conjunto de respostas.
- Validador executável que aplica o schema Draft 2020-12 antes da semântica, rejeita propriedades extras e PII aninhada, exige autoria/data/conteúdo das revisões e decisão, cobertura P01–P08, somas, taxas, estratos e pelo menos 20 respostas válidas externas por combinação arte × cenário.
- Resultado vinculado ao lote pelo SHA-256 da serialização canônica do manifesto completo; mudança de status, estilo, pessoa, arquivo, hash, referência ou licença invalida replay.
- Consolidado vinculado também à versão e aos oito pares ordenados de código + hash; não é possível conservar só o fingerprint antigo e trocar uma arte.
- Proveniência do manifesto ligada ao histórico Git: conteúdo e versão do guia nos commits declarados, SHA-256 normalizado, ancestralidade estrita, ordem temporal e conteúdo histórico das oito artes e referências. Rótulos de versão iguais sem essa prova não abrem o gate.
- Manifesto pronto exige generation plan anterior e generation receipt no commit das artes. Ambos passam pelo schema e vinculam ferramenta, prompt, guia, `sourceOutput`, caminhos, dimensões, hashes e todos os metadados de fonte/autoria/licença. A rejeição atual de P01–P08 permanece intacta porque nenhum contrato histórico foi fabricado.
- Registro de receipts vinculado a caminho, commit, data de commit, hash e lote. O verificador usa `git show`, prova ancestralidade a partir da geração e exige commit anterior à primeira coleta; teste adversarial cobre registro forjado depois do fato.
- Cadeia de custódia recomposta do bundle no gate final: entradas canônicas com ID, hash do receipt e hash da resposta, contagem, intervalo de coleta e raiz SHA-256 ligada ao lote. Cópia renomeada reutilizando receipt é recusada.
- Relógio injetável com tolerância de cinco minutos exige `manifest.generatedAt` < coleta ≤ atestação ≤ revisões ≤ decisão ≤ consolidado e bloqueia futuro. PII recursiva cobre `pessoa`/`voluntária`/`entrevistada` com `mora`/`reside`/`vive`, endereços `s/n`/`sem número` e CEP com ou sem hífen, com controles negativos.
- Gate que recusa qualquer consolidado enquanto `collectionAllowed` não for `true`, exige hashes e proveniência completa e, somente para `seguir`, exige `scaleDecisionAllowed`, limita favorecimento/prejuízo a 20% no total e por cenário e diferença de reconhecimento a 15 pontos percentuais. `iterar` e `abandonar` continuam válidos com escala bloqueada.
- Verificador pós-build que compara hashes e impede afirmar isolamento sem inspecionar `app/dist`; o contexto Docker exclui as artes e fornece somente o manifesto ao estágio de build.
- Workflows com gatilhos para app, shared, `.dockerignore`, créditos, guia, protocolo, resultado, ambos os schemas, manifesto e evidências; o checkout traz o histórico Git completo para a prova de proveniência, e contrato, isolamento e smoke Chromium/WebKit passam a ser checks de CI.

## Verificação técnica

- `npm test`: 160/160 aprovados (4 compartilhados, 39 backend, 117 app), incluindo bundle vazio/legado, replay renomeado, receipt desconhecido ou pós-fato, custódia destacada, geometria, PII, autoria, cronologia, vínculo do lote, neutralidade, reconhecimento, invalidação e denominadores.
- `npm run build --prefix app`: aprovado; 157 arquivos do `dist` inspecionados e nenhum hash do piloto empacotado.
- `npm run test:card-art-pilot-form --prefix app`: aprovado em Chromium e WebKit nos dois cenários; geometria canônica igual ao CSS do app e coleta/exportação bloqueadas.
- `npm run test:card-art-pilot-contract --prefix app`: 55/55 aprovados; Ajv 8.20.0 e ajv-formats 3.0.1 lockados validam generation plan/receipt, registro de receipts, resposta individual, bundle e consolidado em Draft 2020-12 antes da semântica, além do preflight, custódia, prova histórica e contrato do contexto Docker.
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

1. Manter `pilot-2` versionado, sem adaptar a regra ao resultado futuro.
2. Regularizar ou substituir as cinco referências `license-pending`.
3. Criar/commitar o generation plan com as referências definitivas; depois gerar oito imagens novas e commitar o generation receipt junto das artes. P01–P08 atuais não podem ser reaproveitadas.
4. Atualizar manifesto, hashes, contratos históricos e identidade imutável do formulário, e só então mudar `collectionAllowed` após revisão técnica e prova de proveniência.
5. Antes de recrutar, versionar um registro com ao menos 40 hashes de receipts aleatórios não identificadores; distribuir cada nonce uma única vez e registrar o commit no manifesto.
6. Executar o formulário até obter pelo menos 20 respostas válidas externas para cada uma das oito artes em cada cenário.
7. Montar o objeto `response-bundle.json` e rodar `card-art-pilot:validate-participants`; não combinar versões, manifestos, hashes ou receipts.
8. Validar com `card-art-pilot:validate-results -- <resultado.json> <response-bundle.json>`, registrar revisores de identidade/dignidade e uma decisão humana assinada na issue #176; só depois apagar os dados individuais transitórios.
