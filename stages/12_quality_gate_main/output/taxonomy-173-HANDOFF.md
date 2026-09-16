# HANDOFF — ICM 12 · U04 · taxonomia #173

## Status

- Estado: `pronto para revisão local`
- Issue: https://github.com/stefancabral-oss/presidencia-duelo/issues/173
- Macro: https://github.com/stefancabral-oss/presidencia-duelo/issues/175
- Branch: `icm/12-u04-taxonomy-173`
- PR: `não aberta por instrução`
- Commit de implementação: `3cc16091720b523ba9d38b86ae95614e2ef656fd`

## Causa corrigida

O gerador copiava `partido_ou_area` simultaneamente para cargo, afiliação e partido e criava uma área genérica. A mesma prosa passava pela API e era indexada pela busca. A correção cria uma fonte editorial estruturada, materializa os campos uma única vez e bloqueia qualquer valor que viole o contrato.

## Entregue

- Contrato versionado de `role`, `party`, `primaryArea`, `contextAffiliation` e proveniência por atributo.
- Fonte editorial com 125 registros, ligada por nome aos 125 perfis.
- Vocabulário fechado de 16 siglas partidárias e 11 áreas.
- Proveniência preservada no JSON gerado e na allowlist da API.
- Remoção dos campos sobrepostos `affiliation`, `area` e `office` do artefato novo.
- Correção de Antonia Fontenelle: cargo descritivo, `PSDB` e `Comunicação digital`.
- Carta e ranking com um único chip estruturado; perfil com seções separadas.
- Busca restrita a nome, partido e área, com filtros combináveis por partido/área.
- Um único validador compartilhado pelo gerador, teste e CI.
- Screenshot comparativo em `references/taxonomy-comparison.png`.

## Estado editorial explícito

- `role`: 125 `extracted`.
- `party`: 85 `extracted`; 40 `ambiguous` e `null`.
- `primaryArea`: 47 `extracted`; 78 `inferred`.
- `contextAffiliation`: 23 `extracted`; 102 `ambiguous` e `null`.

Nenhum valor foi criado para um atributo ambíguo. `ambiguous` significa falta de suporte suficiente no material disponível, não afirmação de que a pessoa não tem partido ou vínculo.

## Testes e evidências

- `npm run test:shared`: 7/7 testes e validação dos 125 registros.
- `npm test`: 67/67 testes (7 shared, 18 back, 42 app).
- `npm run build`: aprovado; 99/125 retratos presentes e bundle Vite produzido.
- E2E Chromium e WebKit: navegação, rodada, perfil estruturado, busca, filtros e ranking aprovados.
- Regeneração consecutiva: hashes SHA-256 idênticos para candidatos e Chromas.
- Workflow: YAML válido; `test:shared` é chamado uma vez pelo job `shared-data` e os caminhos das três fontes editoriais acionam o workflow.

## Lacunas e riscos preservados

- As 78 áreas `inferred` precisam de gate editorial humano; o código valida o conjunto e a proveniência, não substitui a decisão editorial.
- Quarenta partidos e 102 contextos continuam ambíguos por falta de evidência explícita suficiente.
- Os 125 perfis permanecem com `reviewStatus=pending`; a revisão fonte a fonte descrita no gate editorial anterior não foi simulada nesta unidade.
- O disparo remoto em `pull_request` permanece pendente porque não houve push nem PR.
- `actionlint` não estava disponível neste host; a sintaxe YAML foi validada com `yaml.safe_load` e o workflow deve passar pelo check remoto.

## Próximo passo exato

1. Revisar a amostra visual e as classificações `inferred`.
2. Abrir PR da branch e confirmar o job automático `shared-data` no evento `pull_request`.
3. Somente após o human gate, integrar em `main`.

## Human gate

- Decisão: `pendente`
- Responsável: Stefan Cabral
- Observação: revisar especialmente áreas inferidas, lacunas ambíguas e a separação visual entre partido, área e cargo.
