# HANDOFF — ICM 08

## Status

- Estado: publicado e validado
- Issue: #90
- PR: #113
- Release: `082c80eca21ebd3a9af7c4ea55261034c7c8705b`

## Deploy

- Dokploy API: `back/Dockerfile`, PostgreSQL saudável, 360 perfis.
- Dokploy PWA: `app/Dockerfile`, `VITE_API_URL=https://api-polimatch.e7h3.com`.
- API e PWA confirmados no mesmo commit pelo histórico de deployments.

## Smoke de produção

- Chromium e WebKit passaram em `https://polimatch.com.br`.
- API devolveu 360 resumos editoriais.
- Jogador anônimo, voto, releitura e reenvio idempotente passaram no PostgreSQL.

## Próximo passo

- Usar o deployment anterior no Dokploy em caso de rollback e validar API antes do PWA.
