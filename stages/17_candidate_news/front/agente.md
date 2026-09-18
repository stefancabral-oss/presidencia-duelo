# Agente FRONT — Conheça seu candidato e Notícias

**Estado: planejado.** Este arquivo orienta trabalho futuro. Nenhuma tela, teste, validação humana, publicação editorial ou implantação é declarada concluída.

## Missão

Construir os componentes e telas de apresentação do épico #206 dentro de `app/`. FRONT é uma frente de responsabilidade: não recriar `front/`, não abrir outro frontend e não introduzir um segundo sistema de autenticação.

A consulta pública permanece anônima. O diretório usa candidaturas oficiais, com universo distinto das personalidades do jogo. Os três espaços de notícias apresentam orientação editorial e origem internacional como dimensões diferentes, com lacunas explícitas.

## Antes de editar

1. Ler `AGENTS.md`, `CONTEXT.md` da raiz e `stages/17_candidate_news/CONTEXT.md`.
2. Confirmar a base consolidada após #205; esta expansão possui branch/PR próprias e não altera a entrega anterior implicitamente.
3. Ler contrato versionado e fixtures de [B01 · #210](https://github.com/stefancabral-oss/presidencia-duelo/issues/210), políticas editoriais do épico e interfaces de navegação/cliente acordadas com [A01 · #223](https://github.com/stefancabral-oss/presidencia-duelo/issues/223) e [A02 · #224](https://github.com/stefancabral-oss/presidencia-duelo/issues/224).
4. Registrar escopo, fora de escopo, dependências e critérios no contexto do estágio antes de implementar.

## Arquivos prováveis

- `app/src/main.js`: composição existente; integrar por limites explícitos, evitando ampliar o arquivo com toda a lógica de cada tela.
- Novos módulos dentro de `app/src/` para diretório, ficha, comparação, edição/acontecimento e revisão editorial; caminhos finais definidos ao implementar.
- `app/src/styles.css` e estilos de componentes conforme convenção adotada.
- `app/src/persistent-dom.js` e `app/src/editorial-presentation.js`: preservar contratos existentes e reutilizar quando adequado.
- Fixtures versionadas e testes proporcionais em `app/src/` e `app/e2e/`.
- `stages/17_candidate_news/CONTEXT.md`, `stages/17_candidate_news/output/HANDOFF.md`, `stages/17_candidate_news/output/verification.json` e `stages/17_candidate_news/references/`.

Esses caminhos são candidatos de implementação, não declaração de arquivos já criados. Rotas, persistência de preferência, cliente HTTP, service worker, flags, telemetria e deploy pertencem a APP; dados, autorização e publicação pertencem a BACK.

## Ordem de execução

1. [F01 · #217](https://github.com/stefancabral-oss/presidencia-duelo/issues/217): protótipo e componentes/estados compartilhados sobre [B01 · #210](https://github.com/stefancabral-oss/presidencia-duelo/issues/210).
2. [F02 · #218](https://github.com/stefancabral-oss/presidencia-duelo/issues/218) e [F03 · #219](https://github.com/stefancabral-oss/presidencia-duelo/issues/219) podem avançar em paralelo após F01: diretório e ficha.
3. [F04 · #220](https://github.com/stefancabral-oss/presidencia-duelo/issues/220) compõe diretório/ficha para comparação.
4. [F05 · #221](https://github.com/stefancabral-oss/presidencia-duelo/issues/221) avança após F01 usando fixtures de acontecimentos.
5. [F06 · #222](https://github.com/stefancabral-oss/presidencia-duelo/issues/222) inicia após F01/B01 usando mocks; somente pode ser concluída após [B06 · #215](https://github.com/stefancabral-oss/presidencia-duelo/issues/215) e [A02 · #224](https://github.com/stefancabral-oss/presidencia-duelo/issues/224), com evidência real de integração editorial.

Não exigir que o app completo esteja pronto para renderizar componentes. Usar adaptadores/mocks compatíveis com B01 e registrar a interface que A01/A02 devem conectar. Não substituir autorização de servidor por ocultação de botões.

## Fronteira de conclusão

Os campos dependsOn são pré-requisitos para iniciar. F02–F05 podem concluir a entrega de componentes com fixtures contratuais, testes proporcionais e gate humano da interface; não exigem API/ingestão em operação. A integração real entre frontend, shell, cliente e backend é verificada em [A04 · #226](https://github.com/stefancabral-oss/presidencia-duelo/issues/226); conteúdo/editorial e piloto pertencem a [A05 · #227](https://github.com/stefancabral-oss/presidencia-duelo/issues/227) e suas dependências BACK. F06 tem pré-requisitos adicionais de conclusão (completionDependsOn): [B06 · #215](https://github.com/stefancabral-oss/presidencia-duelo/issues/215) e [A02 · #224](https://github.com/stefancabral-oss/presidencia-duelo/issues/224). Mocks bastam para iniciar F06, nunca para declarar sua autorização/publicação integrada pronta.

## Contratos e evidências

- Receber dados já normalizados e estados explícitos; não inferir candidatura, aprovação editorial, posição política, qualidade ou relação de chapa.
- Identificadores estáveis para eleição/candidatura/pessoa/chapa/acontecimento; vigência e revisão permanecem visíveis quando relevantes.
- Receber callbacks/intents de navegação e ações; não chamar endpoints espalhados nos componentes.
- Usar estados de carregamento, vazio, parcial, pendente, erro, restrito, desatualizado, corrigido e retirado conforme contrato.
- Entregar catálogo de fixtures de contraste e testes de comportamento: seleção incompatível, ausência de foto/proposta, dois suplentes, fontes, lacunas, classificação contestada, erro/retry e conteúdo retirado.
- Produzir evidências reais de viewport, teclado, foco, zoom e leitores de tela quando executadas. Mock e teste automatizado nunca contam como pesquisa humana.
- HANDOFF informa commit/PR, cenários realmente executados, pendências, riscos e contrato entregue a [A04 · #226](https://github.com/stefancabral-oss/presidencia-duelo/issues/226)/[A05 · #227](https://github.com/stefancabral-oss/presidencia-duelo/issues/227). verification.json diferencia planejado, executado, aprovado e bloqueado.

## Regras obrigatórias

- Preservar DOM estável e foco, inclusive durante requests, atualização de dados e diálogos. Não reconstruir a árvore inteira com innerHTML a cada estado.
- Ao sair de uma ficha aberta no jogo, preservar rodada, voto pendente e foco de origem conforme integração APP. Abrir informação nunca confirma/cancela escolha.
- Exposição visual equivalente: mesmos limites e affordances para todos; nenhum acabamento de coleção, cor de mérito, Elo ou ranking nesta consulta.
- Fotos documentais somente quando autorizadas e ligadas à identidade revisada; ausência usa placeholder neutro. Ilustrações continuam adiadas.
- Exibir fonte por afirmação e distinguir proposta, declaração de campanha, registro e fato documentado. Dado pendente não ganha texto inventado.
- Notícias mantêm os três espaços, inclusive faltantes. Internacional não é selo de neutralidade; sindicação não é confirmação independente.
- Renderizar conteúdo externo como texto seguro; links seguem política do contrato. Não executar HTML/importar scripts do material coletado.
- Não ativar coleta de localização precisa, inferência política, publicidade, recomendação eleitoral ou métricas associadas aos votos.
- UI editorial usa sessão/papéis/capacidades fornecidos pelo backend; não criar login/provedor paralelo nem publicar em background.
- Seguir Issue → branch → PR → CI/testes → HANDOFF → human gate. Não aprovar o próprio gate nem fechar item dependente como concluído antes do aceite humano.

## Gate humano pendente

Produto valida navegação, clareza e igualdade de exposição; editorial valida amostras e rótulos; usuários reais e revisão assistiva validam fluxos centrais. Registrar pessoa responsável, data, escopo e ressalvas quando houver avaliação real. Nada neste planejamento satisfaz esses gates.


## Referências de execução

- Frente: [#208](https://github.com/stefancabral-oss/presidencia-duelo/issues/208).
- [Índice desta frente](README.md).
- [Contexto do estágio](../CONTEXT.md).
- [Regras do estágio](../AGENTS.md).
