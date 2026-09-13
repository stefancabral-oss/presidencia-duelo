# ICM 02 — Progresso

## Concluído

- tokens base definidos e documentados;
- famílias de botões criadas;
- cards TCG 5:7 com slots para nome, papel, descrição e meta;
- estados Regular, Rara, Ultra, Chroma, Suprema e Comemorativa;
- playground visual independente do jogo;
- preview de duelo lado a lado;
- estados de foco, loading, selected e reduced motion;
- bridge temporário neutralizando conflitos do CSS legado;
- migração de botões/tabs/topics para o novo design system;
- front e PWA carregam o mesmo design system;
- import do bridge no PWA corrigido para o caminho compartilhado;
- testes de contrato visual e de migração de botões adicionados;
- workflow de CI criado para testar/buildar front e PWA;
- `legacy-migration.md` documenta a retirada gradual do CSS antigo;
- `output/HANDOFF.md` e `output/verification.json` criados.

## Subtarefas concluídas

- #94 Componentes visuais reutilizáveis
- #95 Anatomia e proporção dos cards
- #96 Estados de raridade e Chroma
- #98 Playground visual
- #100 Design tokens

## Em aberto antes do human gate

- #99: limpeza física do CSS legado fica parcialmente adiada para as telas seguintes; o conflito no escopo migrado já foi neutralizado e documentado;
- #97: confirmar CI/build e revisão visual em dispositivo real;
- human gate do #84.

## Referências

- Issue principal: #84
- PR draft: #101
- Playground: `/playground.html` na branch `icm/02-design-system`.
