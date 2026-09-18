# Execução do épico #206

Leia o AGENTS.md e o CONTEXT.md da raiz, o CONTEXT.md deste estágio, a issue #206 e o agente.md da frente antes de iniciar uma microissue.

Este diretório contém o planejamento solicitado por Stefan em 17/09/2026. A criação das issues e documentos não inicia a implementação, não aprova conteúdo editorial e não conclui os gates das etapas anteriores.

## Guias por frente

- Back: [back/agente.md](back/agente.md).
- Front: [front/agente.md](front/agente.md).
- App: [app/agente.md](app/agente.md).

Os arquivos agente.md são instruções de execução referenciadas explicitamente aqui. Front e App trabalham no mesmo pacote app/: Front cuida de componentes/telas e App de shell, rotas, clientes e PWA. Não recriar front/ ou um aplicativo nativo.

## Coordenação

- Escolher uma microissue pronta no grafo de dependências; registrar responsável e branch na issue antes de alterar código.
- Respeitar o contrato B01. Se ele mudar, atualizar fixtures e consumidores de forma coordenada.
- Definir propriedade dos arquivos compartilhados, principalmente app/src/main.js, estilos globais e back/src/http-app.js, antes de edições simultâneas. Preferir módulos novos; não sobrescrever trabalho de outra frente.
- Mocks validam telas e integração inicial; não comprovam API implementada, dados reais aprovados ou cobertura de produção.
- Confirmar o estado da PR #205 antes de escolher a base de implementação. Esta expansão tem PRs próprias.
- Usar PR/CI, HANDOFF e verification por entrega. Evidências humanas só podem ser registradas quando realmente fornecidas.
- Manter issues abertas até seus próprios critérios de conclusão. Não usar o merge desta documentação para fechá-las.
- Não alterar votos, rankings, Espelho ou coleção para atender esta expansão. Leitura política e dados do jogo não alimentam personalização entre si.

Ao entregar uma microissue, atualizar o Markdown correspondente, o checklist da issue e o HANDOFF com commit, evidências, limitações e próximo passo. O GitHub é a referência do estado operacional; os Markdown preservam especificação e roteiro.
