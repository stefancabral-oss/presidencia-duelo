# Handoff — decomposição do épico #206

Estado operacional em 18/09/2026 UTC: #228/#230 mescladas e #210 concluída no GitHub. B02 iniciou implementação autorizada e possui [handoff próprio](B02-HANDOFF.md), [relatório real](B02-pilot-report.json) e evidências B02-verification.json. O restante deste arquivo preserva a entrega documental anterior; não representa o estado operacional atual de B01/B02.

Atualização: a implementação autorizada de B01 possui [handoff próprio](B01-HANDOFF.md) e [evidências próprias](B01-verification.json). O restante deste arquivo preserva a entrega documental #228; suas declarações de ausência de implementação referem-se àquela entrega.

## Entrega

Planejamento separado em Back #207 (7 microissues), Front #208 (6) e App #209 (5), com instruções agente.md e um Markdown por microissue. O README e manifest.json registram a ordem, vínculos e dependências; GitHub acompanha a execução.

O épico original e seu loop de saturação estão preservados em references/epico-206.md. O escopo final inclui candidatos, vices/suplentes, propostas/fontes, notícias com três espaços de cobertura, revisão editorial e operação. Front permanece dentro de app/; App assume shell/integração/PWA.

## Publicação documental

- PR: [#228](https://github.com/stefancabral-oss/presidencia-duelo/pull/228).
- Branch: docs/206-planejamento-frentes.
- Commit inicial dos documentos: [b4d60c5](https://github.com/stefancabral-oss/presidencia-duelo/commit/b4d60c5fdae7394801887ffd1b6b6e4fa52e1aea).
- Hierarquia verificada: #206 contém #207/#208/#209; estas contêm respectivamente 7/6/5 microissues, totalizando 21 ligações pai-filho.
- As 22 issues do conjunto, incluindo o épico, estavam abertas na conferência; as 18 microissues continham roteiro, aceite e link para agente.md.

## Revisão da decomposição

- Separados pré-requisitos para iniciar com mocks e para concluir com integração real (F06 depende de B06 e A02 para conclusão).
- Eliminada dependência operacional circular: B07 entrega prontidão/staging; A05 conduz release e sete dias reais de piloto.
- Cobertura do diretório nacional separada de cobertura editorial estadual, fotografias, biografias e propostas.
- Propriedade dos arquivos compartilhados e coordenação com #205 explicitadas.

## Evidências

As verificações desta entrega são documentais: contagem, integridade de links, passos, referências resolvidas, grafo sem ciclos e hierarquia GitHub. Resultados observados ficam em verification.json. Não foram executados testes de aplicação porque nenhum código de produto mudou.

## Pendente

Toda implementação B01–B07, F01–F06 e A01–A05 permanece planejada. Aprovação editorial, usabilidade/leitor de tela, piloto real, merge da documentação e deploy não são declarados concluídos. A PR documental não deve usar fechamento automático das issues de implementação.

## Próximo passo

Começar por B01 (#210) para contrato e fixtures, seguindo seu agente.md e o processo do repositório. Após o contrato, selecionar unidades prontas pelo grafo. Para cada implementação, registrar PR, CI, HANDOFF e decisões humanas efetivas.

## Rollback

Esta entrega adiciona documentação e organização de issues. Reverter a PR documental não altera jogo ou banco. A hierarquia e as issues podem ser ajustadas mantendo sua rastreabilidade; não apagar o histórico para simular uma execução diferente.

## Correções da revisão da PR #228 — preparação local

Base exata: head documental 47f185a4b3a3d6a7885a9a76c6f5bfda17a29343. Esta preparação não incorpora os arquivos nem o estado de implementação da PR #230.

- B02 conclui com importador e Presidência/uma UF piloto reconciliadas em staging, quarentena e relatórios; publicação de B06 não é condição de início ou conclusão de B02.
- B06 recebe essa entrega para revisão/publicação autorizada posterior. O aceite de importação não equivale a publicação.
- A05 coordena a expansão nacional depois do piloto. BACK continua responsável por importar/reconciliar as demais UFs; B06 fornece o fluxo de revisão/publicação. Presidência e as 27 UFs continuam obrigatórias para concluir o épico.
- CONTEXT, índices e guias BACK/APP foram alinhados com esses limites. O grafo explícito do manifest já era acíclico; foram eliminados os pré-requisitos circulares implícitos no aceite.
- O [verificador documental](check-planning.mjs) percorre todos os Markdown do estágio, incluindo rótulos com colchetes internos, imagens e referências. Confere alvos locais existentes, seções, passos, referências do manifest, grafo e ordem de execução.
- A contagem anterior de 48 links omitia os 18 rótulos de microissues com colchetes internos nos índices. Os [resultados completos](planning-review-results.json) registram a contagem real da preparação final, incluindo os dois links adicionados neste handoff: 68 links relativos em 29 Markdown, nenhum alvo ausente.

Comando reprodutível na raiz do checkout documental preparado:

```powershell
node --input-type=module -e "import('./stages/17_candidate_news/output/check-planning.mjs').then(async ({ verifyPlanning }) => console.log(JSON.stringify(await verifyPlanning('.'), null, 2)))"
```

Execução observada nesta sessão: importação direta do módulo Node e chamada de verifyPlanning com a raiz isolada prepared; não foi executado shell. O resultado foi aprovado, com 3 frentes, 3 guias, 18 microissues, 29 Markdown e 68 links relativos. A hierarquia GitHub não foi reconferida nesta execução; sua evidência anterior permanece identificada separadamente em verification.json.

Pendências: commit/publicação destas correções, CI documental remoto e revisão humana. Não houve commit, push, merge, teste de aplicação, build, deploy ou aprovação editorial nesta preparação. O sandbox de comandos e a política de aprovação do GitHub seguem impedindo publicação nesta sessão.

## Retomada com execução liberada

Em 2026-09-18T00:44:59.089Z, as correções foram aplicadas ao worktree Git da #228 e o verificador foi executado pelo Node CLI: 68 links relativos, 29 Markdown, zero erros. `git diff --check` aprovado. O workflow Civic Planning verifica esses contratos documentais em cada alteração. O bloqueio anterior foi superado; publicação e CI serão confirmados na PR. Nenhum gate de implementação ou editorial foi aprovado.

## Publicação e CI confirmados

Correções publicadas no head `e39e8a68105cedbc1082290762b8da005a74a718`; Civic Planning aprovado no run `35292542364`. Os critérios das issues #211/#215/#227 foram sincronizados, preservando histórico/checklists e estado aberto. As três discussões técnicas corrigidas foram resolvidas; nenhum gate de produto/editorial foi aprovado. Este registro posterior altera somente evidências documentais e será verificado novamente pelo workflow. A branch contém main com #205/#229; a #230 incorpora sua ancestralidade. Mesclar #228 por merge commit preserva a integração.
