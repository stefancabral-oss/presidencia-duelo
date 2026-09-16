# HANDOFF — ICM 12 · U06

## Status

- Estado: `implementação local concluída; gate humano de publicação pendente`
- Issue: https://github.com/stefancabral-oss/presidencia-duelo/issues/171
- Macro: https://github.com/stefancabral-oss/presidencia-duelo/issues/175
- Branch: `icm/12-u06-editorial-gate-171-v2`
- Base: `icm/12-u04-taxonomy-173@b9009233fc3b1461840b3eb082ac2e28623eed0d`
- PR: https://github.com/stefancabral-oss/presidencia-duelo/pull/200 (`draft`; merge não faz parte desta unidade)

## Entregue

- Ledger de decisões editoriais e registro de assets versionados separados do catálogo.
- Estados independentes para conteúdo, arte da carta e foto documental.
- Elegibilidade calculada somente por conteúdo aprovado + arte aprovada; foto ausente não bloqueia.
- Fingerprints SHA-256 que invalidam decisões quando conteúdo, bytes, caminho, versão ou procedência de asset muda.
- Fingerprint de conteúdo sobre o JSON público exato e fingerprint separado de roteamento, sem equivalência entre ausente, `undefined` e `null`.
- Policy local versionada por dimensão apenas para coerência do revisor declarado; ela não autentica identidade nem concede autoridade.
- Autorização de produção exclusivamente por recibo Ed25519 emitido fora do repositório e injetado no processo; ausência, erro ou assinatura divergente mantêm default-deny.
- Gate aceita somente verifier/receipt com marcas privadas atribuídas após validação Ed25519; `true`, callback, objeto sintático, clone e wrapper falham fechados. Fixtures usam assinaturas efêmeras reais.
- Atestação vinculada ao ledger e `review.json` estruturado por candidato/dimensão/decisão, com itens obrigatórios e capturas verificadas por SHA-256, OID Git e commit revisado.
- Verificador local/CI reproduz conteúdo, roteamento, evidências e assets a partir do commit atestado; URLs sem captura e arquivos fora do escopo não liberam decisão.
- Subprocessos Git usam ambiente saneado e `GIT_NO_REPLACE_OBJECTS=1`; teste em repositório real cobre `git replace` e injeções de diretório/configuração.
- Arquivos atuais precisam ser regulares e blobs históricos precisam ter modo `100644`/`100755`; symlinks atuais e modo Git `120000` falham.
- `candidate-public-v1` histórico congelado byte a byte e `candidate-public-v2` separado para a taxonomia da #173.
- Registry, API e CLI correntes usam explicitamente `candidate-public-v2`; snapshots diários continuam escolhendo o projector pelo ruleset persistido e preservam o v1 histórico.
- Locks da sessão diária e da aposta da #178 foram preservados, inclusive reload, meia-noite, troca de identidade e replay.
- Schema recursivo estrito: `facts` somente strings, `sources` somente `{label,url}` e proveniência v2 somente `{status,source}`.
- Snapshots profundos e imutáveis de catálogo, tópicos, ledger, assets, auditoria e payload público; mapas expostos são somente leitura.
- Tópicos inativos/desconhecidos permanecem fechados no registry e na API.
- Falha fechada para dados desconhecidos, duplicados, malformados, sem evidência visível ou com referência/caminho inseguro.
- Clock injetável com limite de data civil em `America/Sao_Paulo`; decisões futuras são recusadas.
- Login declarado do revisor e metadados de versão/procedência rejeitam controles e caracteres invisíveis.
- Campo novo no catálogo é recusado até ser classificado explicitamente na política editorial.
- Registry injetável no domínio, API e store; produção não aceita fixture nem variável de bypass.
- API exclui pendentes/rejeitados e não expõe fingerprints ou auditoria privada.
- UI usa arte aprovada na carta, foto documental aprovada no perfil e placeholder neutro quando ela falta.
- Home conta perfis realmente disponíveis; procedência só declara revisão quando o conteúdo está aprovado.
- Governança com responsáveis, evidência mínima e mutação exata dos dados.
- Matriz automatizada das 27 combinações e smoke visual com e sem foto em Chromium/WebKit.

## Estado editorial real

- Catálogo: 125 pessoas.
- Elegíveis/publicáveis: 0.
- Conteúdo efetivamente `pending`: 125.
- Arte da carta efetivamente `missing`: 125.
- Foto documental efetivamente `missing`: 125.
- Decisões humanas concedidas por esta unidade: nenhuma.

Esse estado é intencional. Assets existentes, nomes legados contendo `approved` e o piloto da #176 não foram promovidos automaticamente.

Portanto, **0 publicáveis é o resultado correto do default-deny sem decisões, atestações e recibos externos válidos; não é falha do build nem da integração**.

## Validação local

- `npm run editorial:verify --prefix back`: aprovado com 0 decisões reais e 0 publicáveis.
- Suite consolidada: 223/223 testes aprovados (16 shared, 119 back, 88 app).
- `npm run build --prefix app`: aprovado com client ID de E2E; 0 assets no registro editorial real, 99/125 retratos legados inventariados e bundle Vite gerado.
- Matriz E2E Chromium e WebKit: nove cenários por navegador aprovados — interação, sessão diária, aposta diária, identidade da aposta, gate editorial, responsividade em 3 telas × 16 viewports, recuperação de voto, estados de confiança e Google simulado.
- `npm audit --omit=dev --prefix app`: 0 vulnerabilidades.
- `npm audit --omit=dev --prefix back`: 0 vulnerabilidades.
- CLI de fingerprint de conteúdo e asset: aprovada.
- `git diff --check`: aprovado.

## Evidência

- Governança: `docs/editorial/PUBLICATION_GOVERNANCE.md`.
- Matriz técnica: `references/issue-171/EVIDENCE.md`.
- Capturas: `references/issue-171/chromium-home.png`, `chromium-profile-with-photo.png` e `chromium-profile-without-photo.png`.

## Pendências externas

- Integração PostgreSQL 16 e prova de abuso não foram executadas localmente porque esta estação não possui Docker, `psql`, serviço PostgreSQL nem `DATABASE_URL`. O workflow `back-shared.yml` executará ambas quando houver PR.
- A integração sobre a #173 está concluída: o registry corrente usa `candidate-public-v2`, com `primaryArea`, `contextAffiliation` e as quatro entradas estritas de `taxonomyProvenance`.
- A integração com a #179 está concluída: o projector `candidate-public-v1` histórico permanece byte a byte e snapshots usam `candidatePublicSnapshot(schema)`, enquanto a API corrente usa `candidatePublicPayload` v2. Nenhum fluxo copia metadados internos do registry.
- Policy, ledger, Git e hashes não autenticam o humano declarado. A autoridade externa é responsável por identidade/competência e emite o recibo Ed25519; o CI apenas verifica esse recibo, integridade e reprodução no commit.
- Cada aprovação real requer a revisão humana individual prevista na governança. Não deve haver preenchimento em massa do ledger.
- O gate visual da #176 é uma evidência necessária para decidir arte, mas não substitui a decisão `cardArt.approved` por pessoa.

## Próximo passo exato

1. Publicar a branch e abrir uma PR draft isolada para a #171, com base em `icm/12-u04-taxonomy-173`.
2. Confirmar os jobs `back-unit`, `shared-data`, `back-integration-postgres`, `validate` e os smokes Chromium/WebKit.
3. Depois da aprovação técnica, iniciar PRs editoriais pequenas: uma decisão humana, uma pessoa, uma base de evidência auditável e o recibo externo correspondente por vez.
4. Só considerar o app com elenco público quando ao menos quatro pessoas tiverem conteúdo e arte aprovados; foto documental continua opcional.

## Human gate

- Implementação do mecanismo: pronta para revisão.
- Publicação dos 125 perfis: bloqueada por decisão humana, por desenho.
- Responsável final: a autoridade externa configurada no ambiente; `stefancabral-oss` é apenas o revisor inicialmente declarado na policy versionada.
