# Evidência — Issue #171

## Regra comprovada

O runtime calcula a elegibilidade por pessoa com a expressão:

```text
conteúdo == approved E arte da carta == approved
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
- um login apenas plausível não basta: `decidedBy` precisa estar autorizado para a dimensão tanto na policy atual quanto na policy do `reviewedCommit`;
- cada decisão depende de atestação existente e íntegra, evidência textual interna no escopo exato candidato/dimensão, SHA-256, OID Git e commit revisado completo;
- atestação ausente, evidência ausente/adulterada, URL externa, logo/asset não relacionado, sujeito divergente e commit não comprovado falham fechados;
- o verificador Git exige que o commit revisado seja ancestral de `HEAD`, reproduz conteúdo e roteamento a partir do catálogo daquele commit e reproduz assets a partir do registry e dos bytes históricos;
- `sources` rejeita campos aninhados extras, `facts` rejeita não strings e os demais campos do catálogo têm tipos e allowlists exatos;
- o fingerprint é calculado sobre os bytes exatos de `JSON.stringify` da projeção pública; roteamento é assinado separadamente, sem colapso de ausente/`undefined`/`null`;
- `candidate-public-v1` possui golden test byte a byte; `candidate-public-v2` é separado e valida `primaryArea`, `contextAffiliation` e cada entrada `{status,source}` de `taxonomyProvenance`.

Os hashes e a allowlist são garantias locais de integridade e autorização declarada. Eles não são descritos como assinatura criptográfica da identidade humana; essa confirmação continua no review.

## Estado real de produção

Consulta direta ao `PRODUCTION_CANDIDATE_REGISTRY` nesta unidade:

```json
{"catalog":125,"playable":0,"contentPending":125,"cardArtMissing":125,"documentaryPhotoMissing":125}
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

- `npm run editorial:verify --prefix back`: aprovado; policy e estado real foram validados com `0 decisões atestadas; 0 candidatos publicáveis`.
- `npm test`: aprovado, 161/161 testes (4 shared, 91 back, 66 app).
- `npm run build --prefix app`: aprovado; verificação editorial reportou `Assets editoriais íntegros: 0` e o Vite gerou o bundle.
- Chromium: interação, gate editorial, 3 telas × 16 viewports, recuperação de voto e estados de confiança aprovados.
- WebKit: a mesma matriz completa aprovada.
- `npm run editorial:fingerprint --prefix back -- content lula`: comando aprovado.
- `npm run editorial:fingerprint --prefix back -- asset app/public/brand/logo-volumetric.png`: comando aprovado.
- Compatibilidade cruzada: os 125 snapshots `candidate-public-v1` ficaram byte a byte iguais ao projector da #179 e os 125 snapshots v2, iguais ao projector corrente da #173.

## Limite local e human gate

Não há Docker, `psql`, serviço PostgreSQL nem `DATABASE_URL` disponíveis nesta estação; por isso, `topic-store-smoke.mjs` e `vote-abuse-smoke.mjs` não puderam ser executados localmente. Ambos permanecem vinculados ao job PostgreSQL 16 de `.github/workflows/back-shared.yml`, agora com registry de fixture explícito.

Nenhum perfil real foi aprovado nesta implementação. A liberação de cada pessoa depende das decisões humanas individualizadas definidas em `docs/editorial/PUBLICATION_GOVERNANCE.md`.
