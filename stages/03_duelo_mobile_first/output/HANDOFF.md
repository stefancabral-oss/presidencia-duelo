# HANDOFF — ICM 03

## Status

- Estado: aprovado e integrado
- Issue: #85
- PRs: #111, #113
- Release: `082c80eca21ebd3a9af7c4ea55261034c7c8705b`

## Entregue

- Voto por toque direto na carta, sem botão Escolher e sem Desfazer.
- Duelo vertical mobile-first, pular, teclado, swipe e ficha separada.
- Feedback de resultado sem navegação inesperada.
- P0 corrigido: falha de sincronização nunca redireciona a escolha ao Ranking.

## Verificação

- Smoke real em Chromium e WebKit, incluindo usuário legado e voto online.
- Teste PWA confirma que o voto só muda a UI depois da resposta do servidor.

## Próximo passo

- Monitorar falhas de API e conflitos de versão do jogador.

## Ajuste responsivo — Issue #158

### Status

- Estado: implementação concluída; aguardando human gate.
- Branch: `fix/desktop-duel-158`.
- PR: pendente.

### Entregue

- O duelo mantém a grade mobile aprovada sem alterações abaixo de 700 px.
- Em PC e iMac, a área útil cresce até 1320 px e distribui as quatro cartas com a mesma exposição.
- As cartas desktop passam a respeitar proporção 5:7, sem recorte, sobreposição ou rolagem horizontal.
- Título e instrução ficam alinhados no mesmo eixo visual.

### Verificação

- 53 testes unitários aprovados.
- Build de produção aprovado com 99 retratos curatoriais ativos e 26 espaços inativos aguardando foto.
- Smoke real aprovado em Chromium e WebKit.
- Viewports 1280 × 900 e 1440 × 900 verificados quanto a proporção, igualdade, limites e overflow.

### Gate humano

- Validar visualmente a nova composição em PC/iMac antes de liberar o deploy.
