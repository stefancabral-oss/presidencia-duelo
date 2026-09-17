# #180 — validação do vocabulário no Espelho

O consumidor do snapshot validava aprovação e proveniência, mas não conferia
o valor contra o vocabulário canônico. Assim, prosa partidária ou uma sigla no
campo de área podiam virar uma frase do Espelho se chegassem com flags válidas.

A leitura agora usa `PARTY_CODES` e `PRIMARY_AREAS` do contrato compartilhado.
Valores externos, incluindo diferenças de grafia/capitalização, entram nas
lacunas, sem limpeza heurística ou reescrita do snapshot. Aprovação e origem
extraída continuam obrigatórias. O grupo já usava conjunto fechado.

O teste de regressão falhou antes da mudança: `PSD` e `politica institucional`
apareciam como áreas. Ele exige agora somente o valor canônico, numeradores e
lacunas corretos, e ausência da prosa `Economia / órbita PL` no retrato.

A #180 continua aberta: dados reais precisam de revisão e aprovação editorial
para os três eixos. Este ajuste não publica dados nem aprova registros.

Verificação local: 332 testes passaram, build de produção passou, fluxo completo
`game-progress.mjs` passou em Chromium. O primeiro ensaio de navegador encontrou
o preview encerrado; após iniciar o preview exclusivo na porta 4173, passou.
O CI da PR complementa a matriz com WebKit e PostgreSQL.
