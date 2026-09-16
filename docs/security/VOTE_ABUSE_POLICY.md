# Política de integridade do voto público

Status: política normativa da API do PoliMatch, versão 1, vinculada à issue #170.

Esta política existe para que o placar público seja um painel de preferências declaradas com limites conhecidos. Ela não transforma o resultado em pesquisa eleitoral nem prova que cada jogador corresponde a uma pessoa única.

## Quem pode votar

- Leituras de catálogo, perfis e ranking continuam públicas.
- Uma escrita no ranking só é aceita quando vinculada a um jogador existente por um token opaco emitido pelo servidor (`pm2_` para visitante anônimo ou `pms_` para sessão Google).
- Requisições sem token, com token inválido ou expirado não alteram o ranking.
- Um login Google verificado é ligado a um único jogador por `provider + subject`; trocar de sessão não cria um novo histórico para a mesma identidade.
- O servidor persiste apenas o hash dos tokens. Tokens e endereços IP brutos não entram em logs nem no banco.

## Quanto cada jogador pode votar

Somente rodadas novas consomem cota. Repetir o mesmo `roundId` com a mesma escolha é uma recuperação idempotente e não consome outra unidade.

| Escopo | Limite | Janela | Resultado ao exceder |
|---|---:|---|---|
| jogador | 8 rodadas | minuto UTC | HTTP 429, `VOTE_RATE_LIMITED` |
| jogador | 30 rodadas | dia UTC | HTTP 429, `VOTE_DAILY_LIMIT` |
| pseudônimo de rede | 3 novos jogadores anônimos | dia UTC | HTTP 429, `PLAYER_ISSUANCE_LIMIT` |

O pseudônimo de rede é `HMAC-SHA-256(identidade de rede normalizada, VOTER_NETWORK_SECRET)`. IPv4 usa o endereço canônico; IPv6 usa o prefixo `/64`, para que endereços temporários da mesma rede não multipliquem cotas. Entradas de proxy que não sejam IP válidos caem numa identidade comum e não podem fabricar pseudônimos arbitrários. A cota de emissão por rede não é usada sozinha: ela limita a multiplicação de tokens, enquanto as duas cotas persistentes por jogador limitam a escrita. O segredo deve ser próprio do ambiente de produção e não pode ser versionado.

Alterar qualquer número exige nova decisão versionada, teste e registro no handoff; não é ajuste operacional silencioso.

## Origem e proxy

- Navegadores só podem chamar a API a partir das origens exatas em `APP_ORIGINS`. A ausência da variável usa apenas `https://polimatch.com.br` em produção. `https://www.polimatch.com.br` fica bloqueada enquanto não for uma origem realmente servida com TLS válido.
- Origens locais de desenvolvimento só são acrescentadas fora de produção.
- Uma requisição com cabeçalho `Origin` fora da lista é rejeitada com HTTP 403 antes de chegar às rotas, e não apenas privada de cabeçalhos CORS.
- Requisições sem `Origin` continuam possíveis para health checks e clientes não navegador, mas passam pelas mesmas exigências de token e cotas.
- `TRUST_PROXY_HOPS` é obrigatório em produção e deve refletir a quantidade real de proxies confiáveis até a API. Valor ausente ou inválido impede a inicialização. Um número incorreto ainda pode agrupar usuários ou aceitar IP forjado: a configuração só é válida se o container não tiver rota pública direta e o proxy sobrescrever/normalizar `X-Forwarded-For`; essa confirmação é parte do gate de deploy.

## Erros, auditoria e privacidade

- Erros 4xx podem explicar a correção necessária e expor apenas campos de contrato documentados.
- Erros 5xx sempre respondem `erro interno`, código `INTERNAL_ERROR` e um `requestId`; mensagens do PostgreSQL e stack traces ficam somente no log do servidor.
- O mesmo `requestId` é devolvido em `X-Request-Id` e incluído no log estruturado.
- Logs de erro não incluem `Authorization`, corpo da requisição, token ou IP bruto.
- Contadores de cota ficam no PostgreSQL, portanto reinício da API e múltiplas réplicas não reiniciam nem dividem o limite.

## Contrato de confirmação no aplicativo

- `ready`: as quatro cartas estão ativas e nenhuma tentativa está pendente.
- `sending`: rodada, vencedor e quatro IDs ficam congelados; cartas e troca são bloqueadas, sem avanço de contador.
- `confirmed`: rankings, contadores e feedback só mudam depois que a resposta completa do servidor é validada.
- HTTP 401: a rodada permanece intacta e a ação `Restabelecer sessão` pede no máximo uma nova credencial por acionamento. Se a leitura posterior falhar, a credencial já emitida é reutilizada.
- HTTP 429: a interface mostra o tempo de espera, mantém a tentativa original e só libera a repetição depois do prazo.
- HTTP 5xx: a interface mostra apenas `Não foi possível confirmar agora.` e oferece repetição idempotente; detalhes internos nunca entram no DOM.
- Falha de rede ou timeout é tratada como resultado incerto, pois o servidor pode ter confirmado a rodada antes de a resposta se perder.

Em todo estado não confirmado, outra carta e a troca da rodada ficam bloqueadas. Toda repetição usa o mesmo `roundId`, vencedor e conjunto de candidatos; o cliente não cria incrementos locais para compensar respostas ausentes ou incompletas.

## Limites conhecidos

Esta defesa reduz automação oportunista e mutirões a partir da mesma infraestrutura, mas não promete unicidade civil. Redes distribuídas, múltiplas contas Google legítimas ou comprometidas e dispositivos em redes diferentes ainda podem ampliar participação. Se os sinais de auditoria mostrarem abuso distribuído, o próximo degrau é exigir identidade verificada, desafio antiautomação ou excluir tráfego não elegível da publicação; nenhum desses passos deve ser ativado sem nova decisão de produto e privacidade.
