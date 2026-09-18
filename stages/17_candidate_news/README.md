# ICM 17 — Candidatos e Notícias: plano de execução

Épico: [#206](https://github.com/stefancabral-oss/presidencia-duelo/issues/206). Esta entrega organiza o trabalho em três frentes e dezoito microissues. Nenhuma funcionalidade deste estágio foi implementada ou publicada por esta entrega documental.

## Frentes

| Frente | Issue principal | Guia | Microissues |
| --- | --- | --- | --- |
| back | [#207](https://github.com/stefancabral-oss/presidencia-duelo/issues/207) | [back/agente.md](back/agente.md) | [7 passos](back/README.md) |
| front | [#208](https://github.com/stefancabral-oss/presidencia-duelo/issues/208) | [front/agente.md](front/agente.md) | [6 passos](front/README.md) |
| app | [#209](https://github.com/stefancabral-oss/presidencia-duelo/issues/209) | [app/agente.md](app/agente.md) | [5 passos](app/README.md) |

Front produz telas/componentes no pacote app/. App produz shell, rotas, clientes e PWA no mesmo pacote. Back produz dados, APIs e operação. Não há recriação de front/ nem novo app nativo.

## Como executar

1. Ler [CONTEXT](CONTEXT.md), [AGENTS](AGENTS.md), [épico original](references/epico-206.md) e o agente.md da frente.
2. Selecionar uma microissue com pré-requisitos atendidos, registrar responsável/branch e coordenar propriedade de arquivos.
3. Executar os passos do Markdown, validar o aceite e registrar evidências reais.
4. Abrir PR delimitada, cumprir CI/gates aplicáveis e atualizar HANDOFF/verification; só então encerrar a microissue.
5. Acompanhar a hierarquia nativa no GitHub; nenhuma issue é encerrada pelo merge desta documentação.

## Dependências

Pré-requisitos para iniciar e para concluir são distintos quando uma tela pode ser desenvolvida com fixtures. Mocks não comprovam integração real. B02 conclui sobre registros reconciliados em staging de Presidência e uma UF piloto, sem depender de publicação por B06. A05 coordena a expansão nacional posterior: BACK importa/reconcilia e B06 revisa/publica. Todas as 27 UFs permanecem condição de conclusão do épico.

| Código | Frente | Issue | Para iniciar | Adicionais para concluir |
| --- | --- | --- | --- | --- |
| B01 | back | [#210](https://github.com/stefancabral-oss/presidencia-duelo/issues/210) | — | — |
| B02 | back | [#211](https://github.com/stefancabral-oss/presidencia-duelo/issues/211) | B01 | — |
| B03 | back | [#212](https://github.com/stefancabral-oss/presidencia-duelo/issues/212) | B01, B02 | — |
| B04 | back | [#213](https://github.com/stefancabral-oss/presidencia-duelo/issues/213) | B01 | — |
| B05 | back | [#214](https://github.com/stefancabral-oss/presidencia-duelo/issues/214) | B01, B04 | — |
| B06 | back | [#215](https://github.com/stefancabral-oss/presidencia-duelo/issues/215) | B01, B02, B03, B04, B05 | — |
| B07 | back | [#216](https://github.com/stefancabral-oss/presidencia-duelo/issues/216) | B02, B03, B04, B05, B06 | — |
| F01 | front | [#217](https://github.com/stefancabral-oss/presidencia-duelo/issues/217) | B01 | — |
| F02 | front | [#218](https://github.com/stefancabral-oss/presidencia-duelo/issues/218) | B01, F01 | — |
| F03 | front | [#219](https://github.com/stefancabral-oss/presidencia-duelo/issues/219) | B01, F01 | — |
| F04 | front | [#220](https://github.com/stefancabral-oss/presidencia-duelo/issues/220) | B01, F02, F03 | — |
| F05 | front | [#221](https://github.com/stefancabral-oss/presidencia-duelo/issues/221) | B01, F01 | — |
| F06 | front | [#222](https://github.com/stefancabral-oss/presidencia-duelo/issues/222) | B01, F01 | B06, A02 |
| A01 | app | [#223](https://github.com/stefancabral-oss/presidencia-duelo/issues/223) | B01 | — |
| A02 | app | [#224](https://github.com/stefancabral-oss/presidencia-duelo/issues/224) | B01 | — |
| A03 | app | [#225](https://github.com/stefancabral-oss/presidencia-duelo/issues/225) | B01, A01, A02 | — |
| A04 | app | [#226](https://github.com/stefancabral-oss/presidencia-duelo/issues/226) | A03, B06, F02, F03, F04, F05, F06 | — |
| A05 | app | [#227](https://github.com/stefancabral-oss/presidencia-duelo/issues/227) | B01, B02, B03, B04, B05, B06, B07, F01, F02, F03, F04, F05, F06, A01, A02, A03, A04 | — |

Uma ordem topológica válida: B01 → B02 → B03 → B04 → B05 → B06 → B07 → F01 → F02 → F03 → F04 → F05 → A02 → F06 → A01 → A03 → A04 → A05. Unidades independentes podem avançar em paralelo, com os gates e a coordenação de arquivos previstos.

## Marcos

- Contratos e fixtures: B01.
- Importador e diretório piloto reconciliado em staging: B02; conteúdo/proveniência: B03; coleta e acontecimentos: B04/B05.
- Telas e shell: F01–F06 e A01–A03, com dependências acima.
- API e prontidão operacional: B06/B07.
- Integração e revisão assistiva: A04.
- Release e piloto real de sete dias: A05, com apoio operacional de Back. B07 prepara staging/runbook e não exige produção antes do primeiro release.
- Expansão nacional durante A05: BACK importa/reconcilia as demais UFs pelo procedimento de B02 e B06 revisa/publica. Diretório final: Presidência e todas as 27 UFs, com denominadores separados de disponibilidade de fotos/textos/notícias; cobertura estadual de notícias explicitamente declarada.

## Artefatos

- [manifest.json](manifest.json): mapa legível por ferramentas, issues e dependências.
- [HANDOFF](output/HANDOFF.md): resultado e próximos passos.
- [verification.json](output/verification.json): verificações realmente executadas.
