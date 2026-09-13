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
