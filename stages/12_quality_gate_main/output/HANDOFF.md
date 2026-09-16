# HANDOFF — ICM 12 · U06

## Status

- Estado: `implementação local concluída; gate humano de publicação pendente`
- Issue: https://github.com/stefancabral-oss/presidencia-duelo/issues/171
- Macro: https://github.com/stefancabral-oss/presidencia-duelo/issues/175
- Branch: `icm/12-u06-editorial-gate-171-v2`
- Base: `main@8f7ba527e03851370b5f5476adc68cd21d655634`
- PR: não criada por esta unidade

## Entregue

- Ledger de decisões editoriais e registro de assets versionados separados do catálogo.
- Estados independentes para conteúdo, arte da carta e foto documental.
- Elegibilidade calculada somente por conteúdo aprovado + arte aprovada; foto ausente não bloqueia.
- Fingerprints SHA-256 que invalidam decisões quando conteúdo, bytes, caminho, versão ou procedência de asset muda.
- Projeção pública única compartilhada pela API e pelo fingerprint, protegendo campos editoriais adicionados no futuro.
- Tópicos inativos/desconhecidos permanecem fechados no registry e na API.
- Falha fechada para dados desconhecidos, duplicados, malformados, sem evidência ou com caminho inseguro.
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

## Validação local

- Suite consolidada: 148/148 testes aprovados (4 shared, 78 back, 66 app).
- `npm run build --prefix app`: aprovado; 0 assets no registro editorial real e bundle Vite gerado.
- `interaction-smoke.mjs`: aprovado em Chromium e WebKit.
- `editorial-gate.mjs`: aprovado em Chromium e WebKit.
- `responsive-layout.mjs`: 3 telas × 16 viewports aprovados em Chromium e WebKit.
- `vote-recovery.mjs`: aprovado em Chromium e WebKit.
- `vote-trust-states.mjs`: aprovado em Chromium e WebKit.
- CLI de fingerprint de conteúdo e asset: aprovada.
- `git diff --check`: aprovado.

## Evidência

- Governança: `docs/editorial/PUBLICATION_GOVERNANCE.md`.
- Matriz técnica: `references/issue-171/EVIDENCE.md`.
- Capturas: `references/issue-171/chromium-home.png`, `chromium-profile-with-photo.png` e `chromium-profile-without-photo.png`.

## Pendências externas

- Integração PostgreSQL 16 e prova de abuso não foram executadas localmente porque esta estação não possui Docker, `psql`, serviço PostgreSQL nem `DATABASE_URL`. O workflow `back-shared.yml` executará ambas quando houver PR.
- Ao integrar a #179, o snapshot diário deve chamar `candidatePublicPayload` (e sua base `candidatePublicContent`) em vez de copiar o candidato do registry. O objeto interno contém `publication.audit`, aprovador, evidências e fingerprints que nunca devem ser persistidos nem servidos pelo snapshot.
- Cada aprovação real requer a revisão humana individual prevista na governança. Não deve haver preenchimento em massa do ledger.
- O gate visual da #176 é uma evidência necessária para decidir arte, mas não substitui a decisão `cardArt.approved` por pessoa.

## Próximo passo exato

1. Publicar a branch e abrir uma PR isolada para a #171.
2. Confirmar os jobs `back-unit`, `shared-data`, `back-integration-postgres` e `UI Interaction Smoke` em ambos os navegadores.
3. Depois da aprovação técnica, iniciar PRs editoriais pequenas: uma decisão humana, uma pessoa e uma base de evidência auditável por vez.
4. Só considerar o app com elenco público quando ao menos quatro pessoas tiverem conteúdo e arte aprovados; foto documental continua opcional.

## Human gate

- Implementação do mecanismo: pronta para revisão.
- Publicação dos 125 perfis: bloqueada por decisão humana, por desenho.
- Responsável final: Stefan Cabral (`stefancabral-oss`) ou pessoa delegada e identificada nominalmente na PR.
