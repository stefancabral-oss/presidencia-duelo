# Evidência — Issue #171

## Regra comprovada

O runtime calcula a elegibilidade por pessoa com a expressão:

```text
conteúdo == approved E arte da carta == approved E recibos externos válidos para ambas as decisões
```

A foto documental é uma terceira decisão independente e nunca participa dessa expressão. Quando ela não está aprovada, o perfil continua permitido e apresenta `Foto documental ainda não disponível`.

## Matriz completa

`back/src/editorial-gate.test.js` percorre programaticamente as 27 combinações de:

- conteúdo: `pending | approved | rejected`;
- arte da carta: `missing | approved | rejected`;
- foto documental: `missing | approved | rejected`.

Para cada combinação, o teste confere os três estados projetados, `eligible`, a presença no assunto e a ausência/presença da foto. Casos adicionais provam:

- conteúdo pendente não é jogável;
- arte ausente não é jogável;
- conteúdo + arte aprovados permanecem jogáveis com foto ausente;
- alteração posterior de conteúdo invalida a aprovação;
- alteração posterior dos bytes, caminho, versão, fonte ou licença de um asset invalida a aprovação;
- catálogo desconhecido, tópico inativo/desconhecido, ledger malformado, data impossível e caminho inseguro falham fechados;
- todos os campos de conteúdo do schema público participam do fingerprint exato; roteamento e assets possuem fingerprints próprios, evitando que um campo novo escape sem classificação explícita.

## Remediação da auditoria independente

Os casos adversariais adicionais comprovam:

- fontes aninhadas, auditorias e payloads públicos são cópias profundas imutáveis; mutar os objetos originais de catálogo, ledger, assets ou tópicos após a construção não altera o registry;
- editar uma URL aninhada antes de criar um novo registry invalida o fingerprint de conteúdo e remove a pessoa do conjunto público;
- `topicsById` e `candidatesById` são fachadas somente leitura, sem `set`, `delete` ou `clear`, e seus valores também são imutáveis;
- o clock é injetável e `decidedAt` futuro falha contra a data civil em `America/Sao_Paulo`, inclusive no limite em que `02:30Z` ainda pertence ao dia anterior em Brasília;
- a policy Git apenas confere a declaração de `decidedBy`; policy, ledger, atestação, hashes e commits não autenticam a pessoa nem concedem autoridade;
- sem verificador externo, com callback indisponível ou sem recibo correspondente, decisões versionadas voltam a `pending`/`missing` e produzem zero elegíveis;
- somente recibos `editorial-authority-receipt-v1` Ed25519 válidos para a requisição exata autorizam; assinatura alterada, configuração parcial ou mudança da atestação falham fechados;
- `authorizedAt` futuro ou anterior a `decidedAt` na data civil de São Paulo é recusado, e o recibo efetivamente usado permanece na auditoria interna;
- cada decisão depende de atestação existente e íntegra, `review.json` estrito ligado a candidato/dimensão/decisão, cobertura integral dos itens revisados, capturas internas verificadas, SHA-256, OID Git e commit revisado completo;
- texto arbitrário `x`, nota/captura trivial, campo aninhado extra, referência adulterada, URL sem captura, logo/asset não relacionado, sujeito divergente e commit não comprovado falham fechados;
- o verificador Git exige que o commit revisado seja ancestral de `HEAD`, reproduz conteúdo e roteamento a partir do catálogo daquele commit e reproduz assets a partir do registry e dos bytes históricos;
- todos os subprocessos Git descartam `GIT_*` herdadas e fixam `GIT_NO_REPLACE_OBJECTS=1`; um teste com repositório Git real prova que `git replace`, `GIT_DIR`, `GIT_WORK_TREE`, object dirs, alternates e configuração injetada não falsificam o commit revisado;
- arquivos atuais precisam ser regulares, sem symlink no alvo ou em diretório ancestral; blobs históricos precisam ser `100644`/`100755`, e um blob real modo `120000` é rejeitado;
- `sources` rejeita campos aninhados extras, `facts` rejeita não strings e os demais campos do catálogo têm tipos e allowlists exatos;
- o fingerprint é calculado sobre os bytes exatos de `JSON.stringify` da projeção pública; roteamento é assinado separadamente, sem colapso de ausente/`undefined`/`null`;
- `candidate-public-v1` possui golden test byte a byte; `candidate-public-v2` é separado e valida `primaryArea`, `contextAffiliation` e cada entrada `{status,source}` de `taxonomyProvenance`.

Hashes e policy são garantias locais de integridade e coerência declarativa. A identidade e a competência do aprovador pertencem ao emissor externo; o repositório aceita apenas o recibo criptográfico que ele emite e não afirma que Git autentica um humano.

## Estado real de produção

Consulta direta ao `PRODUCTION_CANDIDATE_REGISTRY` nesta unidade:

```json
{"authority":{"externalVerifierConfigured":false,"verifiedDecisions":0,"deniedDecisions":0},"catalog":125,"playable":0,"contentPending":125,"cardArtMissing":125,"documentaryPhotoMissing":125}
```

Os arquivos `shared/editorial-publication-ledger.json` e `shared/editorial-asset-registry.json` não contêm decisões nem assets. As 99 imagens encontradas pelo inventário legado e o lote visual da #176 não foram convertidos em aprovações editoriais.

## API e persistência

- `/api/candidates` devolve apenas pessoas elegíveis.
- Tópicos ausentes ou inativos devolvem lista vazia mesmo que uma pessoa aprovada possua aquele `topicId` derivado.
- O teste HTTP injeta duas pessoas, aprova apenas uma e comprova que a pendente não aparece em nenhum trecho do JSON.
- Fingerprints, `decidedBy`, atestação e evidência permanecem internos; a API pública recebe somente estados e procedência pública por `candidatePublicPayload`.
- Snapshots diários devem resolver `candidatePublicSnapshot` pelo schema persistido. O v1 histórico não é substituído pelo v2 e nenhum deles copia o candidato interno.
- O store PostgreSQL aceita um registry injetado. Smokes usam fixtures explicitamente aprovadas; produção usa somente o ledger real, sem bypass por ambiente.
- Reinicializações continuam preenchendo `ranking_stats` e `player_stats` apenas para o conjunto atualmente elegível.

## Interface comprovada

O smoke `app/e2e/editorial-gate.mjs` valida, em Chromium e WebKit:

- home com `4 perfis disponíveis nesta edição`, sem alegar `foto aprovada`;
- carta usando exclusivamente a arte aprovada pela fixture;
- perfil com foto documental, fonte e licença;
- perfil sem foto, com placeholder neutro rotulado;
- procedência `Conteúdo revisado em 16 set 2026`;
- procedência `Arte da carta: ilustração editorial · fixture-v1`;
- ausência da antiga alegação derivada apenas de `reviewedAt`.

Capturas Chromium em 390 × 844:

- `chromium-home.png`;
- `chromium-profile-with-photo.png`;
- `chromium-profile-without-photo.png`.

## Validação local

- `npm run editorial:verify --prefix back`: aprovado; policy e estado real foram validados com `0 decisões atestadas; 0 decisões autorizadas externamente; 0 candidatos publicáveis`.
- `npm test`: aprovado, 165/165 testes (4 shared, 95 back, 66 app).
- `npm run build --prefix app`: aprovado; verificação editorial reportou `Assets editoriais íntegros: 0` e o Vite gerou o bundle.
- Chromium: interação, gate editorial, 3 telas × 16 viewports, recuperação de voto e estados de confiança aprovados.
- WebKit: a mesma matriz completa aprovada.
- `npm run editorial:fingerprint --prefix back -- content lula`: comando aprovado.
- `npm run editorial:fingerprint --prefix back -- asset app/public/brand/logo-volumetric.png`: comando aprovado.
- Compatibilidade cruzada: os 125 snapshots `candidate-public-v1` ficaram byte a byte iguais ao projector da #179 e os 125 snapshots v2, iguais ao projector corrente da #173.

## Limite local e human gate

Não há Docker, `psql`, serviço PostgreSQL nem `DATABASE_URL` disponíveis nesta estação; por isso, `topic-store-smoke.mjs` e `vote-abuse-smoke.mjs` não puderam ser executados localmente. Ambos permanecem vinculados ao job PostgreSQL 16 de `.github/workflows/back-shared.yml`, agora com registry de fixture explícito.

Nenhum perfil real foi aprovado nesta implementação. A liberação de cada pessoa depende das decisões humanas individualizadas e dos recibos emitidos pela autoridade externa definida em `docs/editorial/PUBLICATION_GOVERNANCE.md`.
