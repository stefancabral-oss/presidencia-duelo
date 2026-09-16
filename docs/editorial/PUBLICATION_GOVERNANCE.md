# Governança do portão editorial

Este documento é a regra normativa para publicar uma pessoa no PoliMatch. Catálogo, arquivo existente, nome de pasta, fixture, script ou flag legada nunca constituem aprovação.

## Estados independentes

| Dimensão | Estados possíveis | Efeito público |
|---|---|---|
| conteúdo | `pending`, `approved`, `rejected` | precisa estar `approved` |
| arte da carta | `missing`, `approved`, `rejected` | precisa estar `approved` |
| foto documental | `missing`, `approved`, `rejected` | não bloqueia a publicação |

Uma pessoa só é elegível quando conteúdo e arte da carta estão aprovados e os fingerprints de conteúdo, roteamento, asset e atestação ainda correspondem aos dados verificados. Foto documental é opcional; sem aprovação, a interface usa o placeholder neutro.

## Fronteira externa de autoridade

`shared/editorial-governance-policy.json` schema 2 registra somente quem o arquivo afirma ter revisado cada dimensão. `declaredReviewers` valida a coerência de `decidedBy`; não autentica a pessoa, não concede autoridade e não libera publicação. Ledger, policy, commits, hashes e atestações estão no mesmo domínio Git e provam conteúdo/integridade, nunca identidade humana ou autoridade.

A única autorização aceita em produção é um recibo `editorial-authority-receipt-v1` assinado por Ed25519 fora do repositório. O recibo assina o fingerprint de uma requisição que inclui candidato, dimensão, decisão, sujeito, revisor declarado, data, commit e descritores de evidência. Chave pública, emissor, identificador da chave e lista de recibos são injetados no processo por:

- `EDITORIAL_AUTHORITY_PUBLIC_JWK`;
- `EDITORIAL_AUTHORITY_ISSUER`;
- `EDITORIAL_AUTHORITY_KEY_ID`;
- `EDITORIAL_AUTHORITY_RECEIPTS`.

A chave privada e o ato de conferir identidade/competência pertencem ao emissor externo e nunca entram no Git. Sem as quatro variáveis, com configuração parcial, recibo ausente, assinatura inválida ou requisição divergente, o runtime usa default-deny: conteúdo volta a `pending`, assets voltam a `missing` e ninguém se torna jogável. `npm run editorial:verify --prefix back` também falha se houver qualquer decisão versionada sem recibo externo válido. Hoje o ledger está vazio, portanto a ausência deliberada da autoridade externa resulta em zero aprovados.

`authorizedAt` é um instante UTC canônico assinado. Ele não pode estar no futuro e sua data civil em `America/Sao_Paulo` não pode anteceder `decidedAt`. Os metadados e a assinatura do recibo efetivamente usado ficam preservados na auditoria interna da decisão.

O gate reconhece somente verificadores e provas registrados em marcas privadas pelo módulo que validou a chave e a assinatura Ed25519. Callback comum, retorno booleano `true`, objeto com formato de recibo, clone de recibo válido ou wrapper de um verificador válido não são chamados/aceitos como autoridade. Portanto `authorityVerified === true` implica sempre um `authorityReceipt` criptograficamente validado e não nulo. Fixtures oficiais geram um par Ed25519 efêmero e recibos realmente assinados; não existe atalho booleano de teste.

As responsabilidades continuam separadas:

- conteúdo: revisão factual de cada afirmação pública;
- arte da carta: decisão visual humana após o gate da #176;
- foto documental: identidade, origem e direito de uso.

Declarar outro login exige primeiro atualizar a policy em mudança anterior e revisável, para que a declaração exista no `reviewedCommit`. Mesmo assim, somente o emissor externo pode autorizar a requisição correspondente. Git desprotegido, branch protection, autoria de commit, fixture e mera autoria do código não substituem o recibo.

## Atestação e evidência imutável

Cada dimensão decidida aponta para exatamente um arquivo:

```text
shared/editorial-attestations/<candidateId>/<content|cardArt|documentaryPhoto>.json
```

O arquivo `editorial-attestation-v1` vincula, sem campos extras:

- candidato, dimensão, estado, `decidedBy` e `decidedAt`;
- ruleset e fingerprint exato do sujeito revisado;
- fingerprint de roteamento para conteúdo;
- SHA completo do commit anterior que foi revisado;
- exatamente um registro de evidência JSON estruturado, com `blobSha256` e OID `gitBlob` naquele commit.

Cada evidência deve existir em:

```text
shared/editorial-evidence/<candidateId>/<dimensão>/review.json
```

`editorial-evidence-v1` repete candidato, dimensão e sujeito da decisão; lista todos os campos/checks obrigatórios em `reviewedItems`; e exige ao menos uma referência. Aprovação requer todos os itens `verified`; pendência/ausência exige todos `unavailable`; rejeição exige ao menos um `rejected`. Conteúdo cobre cada campo público mais roteamento. Arte cobre identidade, revisão visual e direito de uso. Foto cobre identidade, fonte e licença.

Cada referência possui exatamente `label`, `sourceUrl`, `path`, `blobSha256` e `gitBlob`. O arquivo capturado precisa existir em `shared/editorial-evidence/<candidate>/<dimensão>/references/`. Uma URL HTTPS pode identificar a origem, mas nunca vale sozinha: ela precisa da captura interna regular, não vazia e vinculada por dois hashes. URL direta, logo, arquivo de outra pessoa, caminho absoluto, travessia, symlink ou texto arbitrário como `x` falham fechados.

O runtime confere arquivos atuais com `lstat` e contenção física por `realpath`: atestação, evidência e capturas precisam ser arquivos regulares, sem symlink no alvo ou em diretório ancestral. `npm run editorial:verify --prefix back` acrescenta prova histórica: o commit existe, é ancestral de `HEAD`, cada entrada tem modo Git `100644` ou `100755`, OID e SHA correspondem, e conteúdo/roteamento ou asset são reproduzidos daquele commit. Todos os subprocessos Git descartam variáveis `GIT_*` herdadas, desativam configs global/system e fixam `GIT_NO_REPLACE_OBJECTS=1`; refs de `git replace`, object dirs e alternates injetados não mudam a verificação.

## Fluxo exato de uma decisão

Uma decisão usa duas etapas para evitar circularidade de hash:

1. Em um primeiro commit, preparar conteúdo/asset, capturas em `references/` e `review.json`. Esse é o commit revisado.
2. Calcular os fingerprints do sujeito no ruleset correto:

   ```powershell
   npm run editorial:fingerprint --prefix back -- content <candidate-id> candidate-public-v1
   npm run editorial:fingerprint --prefix back -- routing <candidate-id> candidate-public-v1
   npm run editorial:fingerprint --prefix back -- asset app/public/<asset>
   npm run editorial:fingerprint --prefix back -- registered-asset <candidate-id> <cardArt|documentaryPhoto>
   ```

3. Obter o SHA completo do commit revisado e, para `review.json` e cada captura, OID Git e `blobSha256` textual:

   ```powershell
   git rev-parse <commit>:shared/editorial-evidence/<candidate>/<dimensão>/<arquivo>
   npm run editorial:fingerprint --prefix back -- file shared/editorial-evidence/<candidate>/<dimensão>/<arquivo>
   ```

4. Criar a atestação JSON e a decisão no ledger com `status`, fingerprints, `decidedBy`, `decidedAt` e `{ path, blobSha256 }` da atestação:

   ```powershell
   npm run editorial:fingerprint --prefix back -- file shared/editorial-attestations/<candidate>/<dimensão>.json
   ```

5. Calcular a requisição que o emissor externo deve avaliar. O sistema externo assina esse fingerprint e injeta JWK/recibos no CI e no deploy; nenhuma chave privada é armazenada aqui:

   ```powershell
   npm run editorial:fingerprint --prefix back -- authority-request shared/editorial-attestations/<candidate>/<dimensão>.json
   ```

6. Com a configuração externa injetada, rodar obrigatoriamente:

   ```powershell
   npm run editorial:verify --prefix back
   npm test
   npm run build --prefix app
   ```

`decidedAt` usa a data civil de `America/Sao_Paulo` e nunca pode estar no futuro. Não se altera `eligible`, `cardArt` ou `photo` no catálogo; são projeções calculadas.

## Schemas públicos e fingerprints exatos

O catálogo usa allowlist recursiva estrita. `facts` aceita somente strings; cada item de `sources` aceita somente `{label,url}` com URL HTTPS; campos escalares têm tipo explícito; `undefined`, campos extras e objetos arbitrários falham fechados.

O fingerprint de conteúdo é SHA-256 de `JSON.stringify(candidatePublicContent(...))` exatamente como serializado, sem canonicalização que colapse ausente, `undefined` e `null`. Roteamento possui fingerprint separado e igualmente exato. Alterar qualquer um invalida a aprovação.

Há dois contratos deliberadamente diferentes:

- `candidate-public-v1`: projector histórico da #179, congelado inclusive na ordem dos campos e coberto por golden test byte a byte;
- `candidate-public-v2`: contrato novo para `primaryArea`, `contextAffiliation` e `taxonomyProvenance`. A proveniência tem exatamente `role`, `party`, `primaryArea` e `contextAffiliation`; cada entrada tem somente `{status,source}`, com status `extracted`, `inferred` ou `ambiguous`.

O v2 não reinterpreta nem substitui snapshots v1. Depois da integração com #173/#179, o alias corrente pode apontar para v2 e um novo ruleset diário pode usá-lo somente em uma nova edição; replay, edição e corte já persistidos continuam resolvendo explicitamente v1.

## Falha fechada

- mudança de conteúdo público invalida o fingerprint de conteúdo;
- mudança de grupo/roteamento invalida o fingerprint de roteamento;
- mudança de bytes, caminho, versão, fonte ou licença invalida o asset;
- mudança de atestação, evidência estruturada ou captura sem atualizar todos os vínculos falha;
- arquivo atual symlink/não regular, modo Git histórico diferente de `100644`/`100755`, commit inexistente, blob/OID divergente ou evidência fora do escopo falham; refs de `git replace` e variáveis Git hostis são ignoradas pela prova;
- policy, ledger, atestação ou commit jamais autorizam sozinhos; recibo externo ausente/inválido mantém default-deny e faz o verificador de CI recusar decisões;
- candidato, personId, tópico, ledger, policy, asset ou campo desconhecido falham;
- snapshots de entrada, auditoria, payload e mapas expostos são profundamente imutáveis;
- consumidores da API usam `candidatePublicPayload`; snapshots diários usam `candidatePublicSnapshot` com o schema persistido, nunca spread/cópia do candidato interno.

## Estado inicial

Ledger e asset registry reais continuam vazios. A autoridade externa não está configurada nesta árvore nem é necessária enquanto não houver decisão. Os 125 perfis ficam em `pending`/`missing`, com zero publicáveis. Atestações e recibos aprovados existem apenas em fixtures de teste; nenhuma decisão humana real foi criada por esta unidade.
