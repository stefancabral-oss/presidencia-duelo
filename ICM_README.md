# PoliMatch — ICM Frontend Rebuild

Este é o ponto de entrada para a reconstrução do frontend do PoliMatch.

## Como retomar o trabalho

Leia nesta ordem:

1. `CONTEXT.md` — decisões globais e limites.
2. `AGENTS.md` — regras de execução.
3. `stages/README.md` — mapa das nove etapas.
4. `stages/NN_nome/CONTEXT.md` — contrato do estágio ativo.
5. `stages/NN_nome/output/HANDOFF.md` — último ponto de continuidade, quando existir.

## Estado do programa

- Fase de governança ICM: **em construção nesta branch**.
- Código de produção atual: `main`.
- Próxima etapa de produto após fundação: **[ICM 02] Design system, cards e botões**.

## Decisões que não podem se perder

- Front claro/porcelana.
- Malaquita estrutural; ouro restrito.
- Chromas concentram cor, foil e brilho.
- Card vertical TCG, sem compressão lateral exagerada.
- Foto/arte dominante, com bloco de informação para nome, quem é, o que faz e descrição.
- Escolha por toque direto na carta; sem botão separado “Escolher”.
- Botões desenhados especificamente para o PoliMatch.
- Som e haptics fazem parte do design de interação.
- Sons de ranking/progresso devem ser neutros entre pessoas: recuperação da lanterna e defesa do líder são estados do jogo, não juízo político.
- SSO real fica para uma rodada posterior.

## Política de alteração

Uma mudança de direção precisa atualizar primeiro os documentos do estágio correspondente. O código não deve virar a única fonte da decisão.

## Resultado esperado

Ao final, um agente novo deve conseguir continuar o projeto sem depender da conversa original: contexto, estágio, evidências, PRs, testes e próximo passo precisam estar no GitHub.
