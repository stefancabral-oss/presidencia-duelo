# Rollback da release

1. No Dokploy, selecione primeiro o deployment anterior da API e use o rollback/redeploy configurado.
2. Confirme `GET /api/health` e `GET /api/candidates` antes de trocar o PWA.
3. Faça rollback do PWA para o deployment imediatamente anterior.
4. Valide Home, Duelo, Ranking e uma criação de jogador sem registrar voto de usuário real.
5. Não reverta ou restaure o PostgreSQL para rollback apenas de código; votos são auditáveis e idempotentes.
