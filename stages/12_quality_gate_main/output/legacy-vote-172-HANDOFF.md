# Handoff — #172: remover voto binário legado

Decisão: alternativa Remover, registrada em
https://github.com/stefancabral-oss/presidencia-duelo/issues/172#issuecomment-5708358827.

O cliente exportava uma função sem consumidor, a API respondia 410 e o store
mantinha uma transação binária sem caminho público. O smoke PostgreSQL ainda
usava essa transação, validando um contrato diferente do produto.

Removidos os três caminhos e o validador exclusivo. O smoke usa `roundVote`
com IDs persistidos antes de cada chamada, mantendo os testes de replay,
reinício, reparação de player_stats, autenticação Google e migração histórica.
São três rodadas e nove comparações; Anitta ganha seis comparações. A tabela
`votes` e os dados históricos são preservados.

Verificação local em Windows / Node 24.19.0: 321 testes aprovados, taxonomia de
125 registros válida, governança editorial válida e build Vite aprovado. O
teste HTTP novo falhou antes da mudança (410 em vez de 404) e passou depois.
As quatro etapas do script de build foram executadas diretamente com Node,
pois npm não está instalado no PATH global. Dependências vieram de `npm ci`.

PostgreSQL não está disponível localmente. O workflow `Backend and Shared`
executa a integração e a prova de abuso em PostgreSQL 16 isolado na PR; seu
resultado precisa ser conferido antes da integração. Nenhum banco produtivo
foi acessado. Gates humanos das demais issues continuam pendentes.

Próximo passo: conferir CI/revisão da PR desta branch. A #182 continua aberta;
um futuro formato de duas cartas deve estender o contrato de rodadas em sua
própria unidade, sem ressuscitar `/api/vote`.
