# Handoff — decomposição do épico #206

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
