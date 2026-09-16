# HANDOFF — ICM 12 · U05

## Status

- Estado: `implementação e validação local concluídas; CI e merge pendentes`
- Issue: https://github.com/stefancabral-oss/presidencia-duelo/issues/170
- Macro: https://github.com/stefancabral-oss/presidencia-duelo/issues/175
- Branch: `icm/12-u05-vote-abuse-170-v2`
- Base: `main@dbf55ca`
- PR: pendente

## Entregue

- Política normativa de integridade escrita antes do código em `docs/security/VOTE_ABUSE_POLICY.md`.
- Token opaco emitido pelo servidor obrigatório para qualquer escrita no ranking.
- Cotas persistentes e atômicas no PostgreSQL: 8 rodadas/minuto e 30/dia por jogador; 3 emissões anônimas/dia por pseudônimo de rede.
- Replay idempotente verificado antes da cobrança de cota.
- Pseudônimo de rede por HMAC-SHA-256, normalização IPv4 e prefixo IPv6 `/64`, sem guardar token ou IP bruto.
- CORS exato, com padrão de produção limitado a `https://polimatch.com.br`; `www`, origem hostil e origens locais em produção ficam bloqueados.
- Inicialização de produção falha sem `VOTER_NETWORK_SECRET` adequado e `TRUST_PROXY_HOPS` explícito.
- Resposta `5xx` genérica com `requestId`; detalhe estruturado permanece no log sem cabeçalho, corpo, token ou IP.
- Fluxo de voto congelado até confirmação completa, com recuperação explícita de `401`, espera de `429`, repetição idempotente de `5xx` e incerteza de rede declarada.
- Página pública `integridade.html` e sinal de confiança no ranking, sem apresentar o placar como pesquisa eleitoral.
- Evidência visual e automatizada dos quatro estados de confiança em Chromium e WebKit.

## Fora desta unidade

- Revisão editorial e portão de publicação: #171.
- Controle separado para abrir perfil: #167.
- Unicidade civil, CAPTCHA obrigatório ou autenticação Google obrigatória.
- Qualquer mudança de catálogo, áudio ou deploy além das variáveis exigidas pela política.

## Validação local

- Suite consolidada: 101/101 testes aprovados (4 shared, 39 back, 58 app).
- `npm run build --prefix app`: aprovado; 99/125 slots de retrato presentes.
- `interaction-smoke.mjs`: aprovado em Chromium e WebKit.
- `responsive-layout.mjs`: 3 telas × 16 viewports aprovados em Chromium e WebKit.
- `vote-recovery.mjs`: aprovado em Chromium e WebKit.
- `vote-trust-states.mjs`: `sending`, `401`, `429` e `5xx` aprovados em Chromium e WebKit.
- Integração PostgreSQL e prova `vote-abuse-smoke.mjs`: aguardam o PostgreSQL 16 do CI; não há instância local disponível.

## Evidência

- Matriz técnica e visual: `references/issue-170/EVIDENCE.md`.
- `references/issue-170/chromium-{sending,401-session-required,429-rate-limited,503-server-error}.png`.
- `references/issue-170/webkit-{sending,401-session-required,429-rate-limited,503-server-error}.png`.
- Estados capturados: `references/issue-170/{chromium,webkit}-states.json`.

## Riscos conhecidos

- A política reduz automação oportunista, mas não garante uma pessoa civil por voto; ataques distribuídos ainda exigiriam outra decisão de identidade e privacidade.
- `TRUST_PROXY_HOPS` só é seguro se o container não estiver publicamente acessível e o proxy sobrescrever `X-Forwarded-For`; essa topologia deve ser confirmada no deploy.
- A nova configuração falha fechada em produção. O ambiente precisa receber `VOTER_NETWORK_SECRET` e `TRUST_PROXY_HOPS` antes de publicar a versão.

## Próximo passo exato

1. Abrir a PR isolada com `Closes #170`.
2. Confirmar unitários, PostgreSQL 16, Design Validator e smokes Chromium/WebKit no CI.
3. Atualizar este handoff com os runs, mesclar pela autorização permanente e verificar o fechamento da #170.
4. Iniciar #171 somente a partir da nova `main`.

## Human gate

- Decisão: `autorização permanente concedida para merge quando isolada e verde`
- Responsável: Stefan Cabral
- Observação: não usar essa autorização para misturar a #171.
