# Investigação do não-disparo da PR #162

## Conclusão

A PR #162 não disparou workflows no evento `pull_request` porque já estava em conflito com a base. A documentação do GitHub registra que workflows desse evento não rodam enquanto houver conflito de merge:

- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request

Não foi adotado `pull_request_target`: além de não ser necessário para este caso, ele muda o contexto de segurança do workflow.

## Evidência observada em 2026-09-16

- PR: https://github.com/stefancabral-oss/presidencia-duelo/pull/162
- estado retornado pela API: `mergeable=CONFLICTING`, `mergeStateStatus=DIRTY` e `statusCheckRollup=[]`;
- primeiro commit da branch: `650e3da54cdae9a4b6242a3c25adbf05271ee1aa`, com pai `4c192204c7d2262de9caf5965341314de9c59544`;
- base registrada pela PR: `9818c1d191486e32aa55061001e4acd4ec64e7f7`;
- `git merge-tree` entre o head inicial `5fc4cd623b7847daff4d598979e82dcea56469dc` e essa base reproduz conflito textual em `app/src/api.js`; outros arquivos alterados dos dois lados são auto-mescláveis;
- `main` observado no início de U01: `fa06277722761c6a183492c2a401c27464f28225`;
- a branch também está atrás da `main` atual e conflita com mudanças já integradas.

Os três runs associados à branch foram acionados manualmente (`event=workflow_dispatch`), portanto comprovam o conteúdo dos workflows, mas não o gatilho automático:

- Design Validator: https://github.com/stefancabral-oss/presidencia-duelo/actions/runs/35040127075
- UI Interaction Smoke: https://github.com/stefancabral-oss/presidencia-duelo/actions/runs/35040124969
- UI Interaction Smoke após o E2E de recuperação: https://github.com/stefancabral-oss/presidencia-duelo/actions/runs/35040808480

## Consequência para U01

O diagnóstico satisfaz a alternativa de causa da issue #174, mas não autoriza misturar a recuperação de #162 nesta branch. A remoção de `front/**` em `.github/workflows/ui-interaction-smoke.yml` fica bloqueada até #162 ser resolvida; todos os demais arquivos de U01 permanecem independentes.
