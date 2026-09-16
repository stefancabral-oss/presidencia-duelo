# Governança do portão editorial

Este documento é a regra normativa para publicar uma pessoa no PoliMatch. Catálogo, arquivo existente, nome de pasta, fixture, script ou flag legada nunca constituem aprovação.

## Estados independentes

| Dimensão | Estados possíveis | Efeito público |
|---|---|---|
| conteúdo | `pending`, `approved`, `rejected` | precisa estar `approved` |
| arte da carta | `missing`, `approved`, `rejected` | precisa estar `approved` |
| foto documental | `missing`, `approved`, `rejected` | não bloqueia a publicação |

Uma pessoa só é elegível quando conteúdo e arte da carta estão aprovados e os fingerprints de conteúdo, roteamento, asset e atestação ainda correspondem aos dados verificados. Foto documental é opcional; sem aprovação, a interface usa o placeholder neutro.

## Autorização e limite de identidade

`shared/editorial-governance-policy.json` é a allowlist versionada de revisores por dimensão. O gate aceita uma decisão somente quando `decidedBy` tem sintaxe de login GitHub e consta na dimensão correta dessa política. A política inicial autoriza `stefancabral-oss`.

Isso é autorização declarativa e auditável no repositório, não autenticação criptográfica da pessoa. O hash da atestação prova integridade dos bytes; não prova quem os escreveu. A revisão humana da mudança continua responsável por confirmar a identidade declarada. O código e o CI não alegam uma garantia que não possuem.

As responsabilidades continuam separadas:

- conteúdo: revisão factual de cada afirmação pública;
- arte da carta: decisão visual humana após o gate da #176;
- foto documental: identidade, origem e direito de uso.

Delegar exige primeiro registrar o login em uma mudança anterior e revisável, de forma que a allowlist autorizadora já exista no `reviewedCommit`. O verificador comprova que essa policy consta daquele commit e que ele é ancestral de `HEAD`; ele não autentica a identidade humana nem prova, sozinho, que a mudança passou por uma PR separada. Automação, fixture ou mera autoria do código não autorizam aprovação real.

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
- uma ou mais evidências textuais internas, cada uma com `blobSha256` e OID `gitBlob` naquele commit.

Cada evidência deve existir em:

```text
shared/editorial-evidence/<candidateId>/<dimensão>/<arquivo.md|json|txt>
```

O escopo impede que um logo, uma imagem qualquer ou um documento de outra pessoa seja apresentado como prova daquela decisão. URL externa, HTTP/HTTPS, caminho absoluto e travessia não satisfazem o gate. Quando uma fonte externa for necessária, a revisão deve capturar em evidência interna o material efetivamente conferido; citar uma página mutável não é prova imutável.

O runtime confere arquivo existente, schema, allowlist, SHA-256 textual normalizado e correspondência integral entre ledger e atestação. `npm run editorial:verify --prefix back` acrescenta a prova histórica local pelo Git: o commit existe, é ancestral de `HEAD`, cada OID e blob correspondem, e o conteúdo/roteamento ou asset naquele commit produz exatamente o fingerprint atestado. O workflow `back-unit` executa essa prova com histórico completo (`fetch-depth: 0`), sem depender de uma configuração externa de branch protection.

## Fluxo exato de uma decisão

Uma decisão usa duas etapas para evitar circularidade de hash:

1. Em um primeiro commit, preparar o conteúdo ou asset e os arquivos em `shared/editorial-evidence/...`. Esse é o commit revisado.
2. Calcular os fingerprints do sujeito no ruleset correto:

   ```powershell
   npm run editorial:fingerprint --prefix back -- content <candidate-id> candidate-public-v1
   npm run editorial:fingerprint --prefix back -- routing <candidate-id> candidate-public-v1
   npm run editorial:fingerprint --prefix back -- asset app/public/<asset>
   npm run editorial:fingerprint --prefix back -- registered-asset <candidate-id> <cardArt|documentaryPhoto>
   ```

3. Obter o SHA completo do commit revisado, o OID Git de cada evidência nesse commit e o `blobSha256` textual:

   ```powershell
   git rev-parse <commit>:shared/editorial-evidence/<candidate>/<dimensão>/<arquivo>
   npm run editorial:fingerprint --prefix back -- file shared/editorial-evidence/<candidate>/<dimensão>/<arquivo>
   ```

4. Criar a atestação JSON, calcular seu fingerprint textual e então criar/atualizar a decisão no ledger com `status`, fingerprints, `decidedBy`, `decidedAt` e `{ path, blobSha256 }` da atestação:

   ```powershell
   npm run editorial:fingerprint --prefix back -- file shared/editorial-attestations/<candidate>/<dimensão>.json
   ```

5. Rodar obrigatoriamente:

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
- mudança de atestação ou evidência sem atualizar todos os hashes falha;
- commit inexistente, blob/OID divergente, revisor não autorizado ou evidência fora do escopo falham no verificador local/CI;
- candidato, personId, tópico, ledger, policy, asset ou campo desconhecido falham;
- snapshots de entrada, auditoria, payload e mapas expostos são profundamente imutáveis;
- consumidores da API usam `candidatePublicPayload`; snapshots diários usam `candidatePublicSnapshot` com o schema persistido, nunca spread/cópia do candidato interno.

## Estado inicial

Ledger e asset registry reais continuam vazios. Os 125 perfis ficam em `pending`/`missing`, com zero publicáveis. Atestações aprovadas existem apenas em fixtures de teste; nenhuma decisão humana real foi criada por esta unidade.
