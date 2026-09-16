# HANDOFF — ICM 12 · U02 · persistência do DOM

## Status

- Estado: `implementação e verificações locais concluídas; human gate pendente`
- Issue: https://github.com/stefancabral-oss/presidencia-duelo/issues/166
- Macro: https://github.com/stefancabral-oss/presidencia-duelo/issues/175
- Branch: `icm/12-u02-dom-persistence-166`
- PR: `não aberta por instrução desta execução`
- Base da unidade: `02f0b8a211b77e27cb9707646c983c81c08ca95d`
- Commit da implementação: `7faa34a583c74a1d6fc368d58d8da79d01e57988`
- Commit da integração revisada: `4c6eb249185d347aaa894fecb3116dbd42a824cc`
- Commit da correção final de foco: `704a66ecf2543ae40943bbce3d60db16d33394b3`
- Commit da transição final e dos smokes integrados: `ba4ddb1f2a5a7831cc6f894eab95f59c1c2e6753`
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
- O workflow de UI executa `interaction-smoke.mjs` e `vote-recovery.mjs` em Chromium e WebKit e também reage a mudanças de `shared/`.

## Fora de escopo preservado

- #167 continua responsável pelo caminho de teclado do perfil, pela dica móvel e pela modalidade real do overlay inicial.
- O cálculo de ranking não foi alterado; a integração limita-se a preservar metadados de erro da API, expor a versão atual em `409` e recuperar o fluxo do cliente.
- Os artefatos genéricos `output/HANDOFF.md` e `output/verification.json` continuam pertencendo a U01/#174 e não foram modificados.

## Evidência local

- `npm test`: 87/87 testes aprovados (4 shared, 28 backend e 55 app).
- `npm run build --prefix app`: aprovado; 99/125 retratos disponíveis e bundle Vite produzido.
- `POLIMATCH_E2E_BROWSER=chromium node app/e2e/interaction-smoke.mjs`: aprovado.
- `POLIMATCH_E2E_BROWSER=webkit node app/e2e/interaction-smoke.mjs`: aprovado.
- `POLIMATCH_E2E_BROWSER=chromium node app/e2e/vote-recovery.mjs`: aprovado nos quatro cenários, incluindo Enter real e `activeElement` na carta pendente antes e depois da nova rodada.
- `POLIMATCH_E2E_BROWSER=webkit node app/e2e/vote-recovery.mjs`: aprovado no mesmo contrato de teclado e foco.
- Variante Chromium com `VITE_GOOGLE_CLIENT_ID` e `POLIMATCH_E2E_GOOGLE=1`: aprovada.
- No smoke, o observador registrou zero substituições; topbar, nav, instrução, repetição, região viva, slots e botões mantiveram igualdade referencial; o foco visível permaneceu no botão votado.
- A regressão de retrato quebrado é coberta por teste unitário: o mesmo `src` não reaparece depois do erro e um novo `src` só aparece após `load`.
- O smoke Playwright revalidou `320×568` com rolagem vertical e sem recorte da segunda linha/resultado, `390×844` com quatro cartas completas, `1280×900` com proporção 5:7 e `1440×900` sem overflow horizontal.

## Auditoria da PR #162 e da base corrente

- `5fc4cd6`, `2f3327b`, `650e3da`, `bb924b7` e `ffd1bdc` são ancestrais reais de `HEAD` por meio do merge `6eed68a`; não há mais porte paralelo a reconciliar.
- A base corrente também contém os hotfixes `357a3de` e `8411b53`, que preservam a anatomia da carta e a placa completa de resultado em celulares estreitos.
- `36e00f6` e `02f0b8a` mantêm ranks pessoais server-authoritative e listam perfis já comparados antes dos ainda não jogados; a #166 apenas atualiza esses dados nos mesmos nós persistentes.

## Pendente

- Executar NVDA ou VoiceOver real e anexar a transcrição do que foi ouvido em `Confirmando`, `Confirmado` e `Nova rodada`.
- Observar os checks automáticos após a futura publicação da PR.

## Riscos conhecidos

- A entrega automática prova mutações e foco do DOM, mas não prova a fala nem o comportamento do cursor virtual de um leitor de tela real.
- `vote-recovery.mjs` usa um servidor HTTP simulado e stateful; os testes de backend continuam cobrindo separadamente o contrato de domínio.

## Próximo passo exato

1. Integrar esta unidade sem misturar #167.
2. Rodar o CI da PR, incluindo Chromium e WebKit.
3. Fazer o gate humano com NVDA no Windows ou VoiceOver e registrar a transcrição.

## Human gate

- Decisão: `pendente`
- Responsável: Stefan Cabral
- Observação: nenhum agente aprovou o próprio gate assistivo.
