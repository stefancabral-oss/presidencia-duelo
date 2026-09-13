# [ICM 08] Release, deploy e observabilidade

## Objetivo

Publicar com controle e confirmar que produção corresponde ao commit aprovado.

## Escopo

- versão/commit de release;
- build reproduzível;
- deploy no Dokploy;
- confirmação do SHA/artefato publicado;
- smoke test em produção;
- checklist de rollback;
- sinais mínimos de erro e disponibilidade.

## Critérios de aceite

- Produção comprovadamente usa o commit aprovado.
- Duelo, Torneio, Ranking e Coleção abrem e funcionam.
- API de saúde não é usada como único sinal de compatibilidade funcional.
- Rollback documentado antes de mudanças de alto risco.
