# HANDOFF — ICM 12 · U02 · persistência do DOM

## Status

- Estado: `implementação e verificações locais concluídas; human gate pendente`
- Issue: https://github.com/stefancabral-oss/presidencia-duelo/issues/166
- Macro: https://github.com/stefancabral-oss/presidencia-duelo/issues/175
- Branch: `icm/12-u02-dom-persistence-166`
- PR: draft #191 — https://github.com/stefancabral-oss/presidencia-duelo/pull/191
- Base da unidade: `8f7ba527e03851370b5f5476adc68cd21d655634`
- Commit da implementação rebaseada: `cf25c6b`
- Commit da integração revisada: `0640e6c`
- Commit da correção final de foco: `2b4090b`
- Commit da transição final e dos smokes integrados: `831a990`
- Commit de integração com o contrato vigente de voto: `b13c1a1`
- Compatibilidade herdada: PR #162 integrada por `6eed68a`; viewport curto reforçado por `357a3de` e `8411b53`; ranking pessoal autoritativo reforçado por `36e00f6` e `02f0b8a`.

## Entregue

- Shell, topbar, navegação, painéis de Início/Duelo/Ranking, instrução, região viva e quatro slots de carta são montados uma vez.
- Cada nova rodada altera granularmente os mesmos controles: fotografia, nome acessível, textos, atributos, classes e resultado.
- O app deixou de executar `app.innerHTML = ...` e `bindEvents()` a cada estado; eventos do app são delegados uma vez e o gesto das quatro cartas é instalado uma vez.
- Cartas ocupadas usam `aria-disabled="true"` sem sair da ordem de foco; tentativas adicionais continuam bloqueadas por estado.
- Uma única região `role="status"`, inicialmente vazia, anuncia em sequência `Confirmando sua escolha…`, o resultado confirmado e `Nova rodada disponível`.
- O smoke usa oito candidatos para garantir troca real de conteúdo e um `MutationObserver` para detectar qualquer substituição dos nós persistentes.
- Testes unitários cobrem atualização in-place dos quatro slots, indisponibilidade sem `disabled` e troca de painel sem remount.
- O smoke existente manteve suas verificações de layout, pressão longa, resultado Elo, navegação, ranking e Google; as novas asserções foram adicionadas sem remover as anteriores.
- A recuperação de voto da PR #162 foi transplantada semanticamente, sem merge ou cherry-pick: o `roundId` nasce com a rodada, a repetição é idempotente e apenas um `401` descarta a chave local.
- O controle `Tentar de novo` agora faz parte do DOM persistente, começa oculto, usa o listener delegado existente e mantém igualdade referencial durante a falha.
- Ao repetir por teclado, o foco sai de `Tentar de novo` antes que ele seja ocultado e vai para o botão persistente da candidata pendente; a mesma referência continua ativa depois da nova rodada.
- Timeout/rede exibem uma mensagem honesta de resultado incerto; conflito `409` ressincroniza a versão e uma resposta `503` preserva o histórico local.
- Uma fotografia que retorna erro fica oculta nos renders seguintes; apenas uma URL nova seguida de `load` volta a revelar o elemento.
- O controle persistente alterna honestamente entre `Restabelecer sessão` e `Tentar novamente`; cartas pendentes usam `aria-disabled` sem perder foco e ignoram toque, teclado e pressão longa até a recuperação explícita.
- Falhas assíncronas de login ou logout mantêm foco dentro do diálogo de autenticação; o botão Google é remontado para nova tentativa sem loop quando o provedor está indisponível.
- O workflow de UI executa `interaction-smoke.mjs` e `vote-recovery.mjs` em Chromium e WebKit e também reage a mudanças de `shared/`.

## Fora de escopo preservado

- #167 continua responsável pelo caminho de teclado do perfil, pela dica móvel e pela modalidade real do overlay inicial.
- O cálculo de ranking não foi alterado; a integração limita-se a preservar metadados de erro da API, expor a versão atual em `409` e recuperar o fluxo do cliente.
- Os artefatos genéricos `output/HANDOFF.md` e `output/verification.json` continuam pertencendo a U01/#174 e não foram modificados.

## Evidência local

- `npm test`: 111/111 testes aprovados (4 shared, 39 backend e 68 app).
- `npm run build --prefix app`: aprovado; 99/125 retratos disponíveis e bundle Vite produzido.
- `POLIMATCH_E2E_BROWSER=chromium node app/e2e/interaction-smoke.mjs`: aprovado.
- `POLIMATCH_E2E_BROWSER=webkit node app/e2e/interaction-smoke.mjs`: aprovado.
- `POLIMATCH_E2E_BROWSER=chromium node app/e2e/vote-recovery.mjs`: aprovado em timeout, 503, 401, 409, idempotência, resposta 200 truncada e replay legado.
- `POLIMATCH_E2E_BROWSER=webkit node app/e2e/vote-recovery.mjs`: aprovado nos mesmos sete cenários e no mesmo contrato de teclado e foco.
- `vote-trust-states.mjs`: aprovado em Chromium e WebKit para `sending`, 401, 429 e 5xx.
- `responsive-layout.mjs`: aprovado em Chromium e WebKit, medindo o painel persistente ativo em 16 viewports.
- Variante com `VITE_GOOGLE_CLIENT_ID` e `POLIMATCH_E2E_GOOGLE=1`: aprovada em Chromium e WebKit, incluindo falha e retry de login/logout com foco dentro do diálogo.
- No smoke, o observador registrou zero substituições; topbar, nav, instrução, repetição, região viva, slots e botões mantiveram igualdade referencial; o foco visível permaneceu no botão votado.
- A regressão de retrato quebrado é coberta por teste unitário: o mesmo `src` não reaparece depois do erro e um novo `src` só aparece após `load`.
- O smoke Playwright revalidou `320×568` com rolagem vertical e sem recorte da segunda linha/resultado, `390×844` com quatro cartas completas, `1280×900` com proporção 5:7 e `1440×900` sem overflow horizontal.

## Auditoria da base corrente

- `5fc4cd6`, `2f3327b`, `650e3da`, `bb924b7` e `ffd1bdc` são ancestrais reais de `HEAD` por meio do merge `6eed68a`; não há mais porte paralelo a reconciliar.
- A base corrente também contém os hotfixes `357a3de` e `8411b53`, que preservam a anatomia da carta e a placa completa de resultado em celulares estreitos.
- `36e00f6` e `02f0b8a` mantêm ranks pessoais server-authoritative e listam perfis já comparados antes dos ainda não jogados; a #166 apenas atualiza esses dados nos mesmos nós persistentes.
- A base `8f7ba52` incorpora #170 e o follow-up #193: resposta exata, limites, idempotência, recuperação de sessão e descarte de respostas de identidade antiga foram preservados no DOM persistente.

## Pendente

- Executar NVDA ou VoiceOver real e anexar a transcrição do que foi ouvido em `Confirmando`, `Confirmado` e `Nova rodada`.
- Observar os checks automáticos após a futura publicação da PR.

## Riscos conhecidos

- A entrega automática prova mutações e foco do DOM, mas não prova a fala nem o comportamento do cursor virtual de um leitor de tela real.
- `vote-recovery.mjs` usa um servidor HTTP simulado e stateful; os testes de backend continuam cobrindo separadamente o contrato de domínio.

## Próximo passo exato

1. Atualizar a draft PR #191 e aguardar todos os checks, incluindo PostgreSQL, Chromium e WebKit.
2. Fazer o gate humano com NVDA no Windows ou VoiceOver e registrar a transcrição.
3. Só então retirar o draft e integrar, sem misturar #167.

## Human gate

- Decisão: `pendente`
- Responsável: Stefan Cabral
- Observação: nenhum agente aprovou o próprio gate assistivo.
