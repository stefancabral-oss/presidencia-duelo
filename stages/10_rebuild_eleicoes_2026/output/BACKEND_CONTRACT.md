# Contrato do backend novo

## Preservar no piloto

- `GET /api/health`: disponibilidade do serviço e PostgreSQL.
- `GET /api/topics`: assuntos ativos e expansões anunciadas.
- `GET /api/candidates?topic=eleicoes-2026`: catálogo curado. Cada perfil separa `role`, `party`, `primaryArea` e `contextAffiliation`, preserva `taxonomyProvenance` por atributo e também expõe `bio`, `location`, `facts`, `sources` e `reviewStatus`.
- `GET /api/ranking?topic=eleicoes-2026`: ranking agregado por assunto, com escolhas, não escolhas, total de comparações e percentual.
- `POST /api/vote`: voto online, idempotente por `voteId`.
- `POST /api/player` e `GET /api/player/state?topic=eleicoes-2026`: criação, recuperação e ranking pessoal anônimo.
- Transações, validação de IDs e atualização Elo.

## Substituir antes da edição definitiva

- Metadados editoriais ainda marcados como `pending` por perfis revisados e publicados.

## Remover do produto novo

- Modo `vices` como seção visível.
- Reversão de voto na interface.
- Dependência do frontend em estado local para confirmar escolhas.

## Condição para apagar produção

O reset destrutivo do PostgreSQL será executado separadamente, com alvos explícitos, depois que a página temporária ou o piloto novo estiver pronto para publicação.
