# Agente — APP: integração, PWA e operação

## Missão
Integrar as áreas “Conheça seu candidato” e “Notícias” no Vite/PWA existente, preservando a sessão de jogo, a leitura pública anônima, a navegação acessível e a publicação editorial versionada. APP é a integração e operação do pacote `app/`; não haverá app nativo nem novo pacote `front/`.

Este arquivo orienta implementação futura. A criação das issues e destes markdowns não significa código implementado, teste executado, aprovação humana, merge, agendamento ou deploy.

## Fonte de verdade
Ler o `AGENTS.md` e o `CONTEXT.md` da raiz, o CONTEXT deste programa e a issue #206 antes de alterar código. Confirmar a base incorporada da #205 sem editar sua branch de consolidação. Preservar fotografias documentais e o adiamento das ilustrações.

## Propriedade de arquivos
- APP possui integração em `app/src/main.js`, adaptadores de API/estado, roteamento, preferência local de UF, flags, `app/public/sw.js`, configuração do PWA/Vite, harnesses E2E e runbooks de release.
- FRONT possui telas e componentes visuais das novas áreas e seus estilos isolados dentro do mesmo `app/`.
- BACK possui modelos, importadores, endpoints, autenticação/autorização editorial, publicação, revogação e operação dos dados.
- Novos módulos de APP devem ficar em diretórios de integração definidos no contrato [A01 · #223](https://github.com/stefancabral-oss/presidencia-duelo/issues/223), com caminhos documentados antes do primeiro patch. Não criar uma segunda implementação de router, cliente API ou store que já exista e sirva ao contrato.
- `app/src/main.js`, `styles.css`, manifest, arquivos de configuração e testes compartilhados são pontos de coordenação: anunciar o patch, combinar um único dono por vez e integrar por hooks explícitos. FRONT não altera shell/estado de votação implicitamente; APP não reescreve telas aprovadas.

## Contrato com FRONT e BACK
Definir interfaces de montagem/desmontagem, props de dados, ações de navegação, foco e cancelamento de requisições em [A01 · #223](https://github.com/stefancabral-oss/presidencia-duelo/issues/223). FRONT entrega componentes que consomem modelos públicos; APP conecta rotas, preferências e clientes. [A01 · #223](https://github.com/stefancabral-oss/presidencia-duelo/issues/223) e [A02 · #224](https://github.com/stefancabral-oss/presidencia-duelo/issues/224) avançam com fixtures/placeholders após [B01 · #210](https://github.com/stefancabral-oss/presidencia-duelo/issues/210), sem esperar telas prontas. BACK expõe IDs e versões estáveis, erros, frescor, cobertura e retirada; o cliente não infere esses estados de strings nem publica dados pendentes.

## Ordem de execução
1. [B01 · #210](https://github.com/stefancabral-oss/presidencia-duelo/issues/210) fecha o contrato base.
2. [A01 · #223](https://github.com/stefancabral-oss/presidencia-duelo/issues/223) e [A02 · #224](https://github.com/stefancabral-oss/presidencia-duelo/issues/224) podem avançar em paralelo com mocks aprovados e arquivos separados.
3. [A03 · #225](https://github.com/stefancabral-oss/presidencia-duelo/issues/225) liga cache, flags e isolamento sobre os contratos.
4. [A04 · #226](https://github.com/stefancabral-oss/presidencia-duelo/issues/226) integra as telas e APIs, valida cenários reais de contrato e registra as evidências.
5. [A05 · #227](https://github.com/stefancabral-oss/presidencia-duelo/issues/227) é dona da liberação gradual e do piloto real de sete dias, com suporte operacional e dados de BACK; também coordena expansão/reconciliação nacional e handoff. B02 entrega Presidência/UF piloto reconciliadas em staging; BACK executa a importação/reconciliação das demais UFs durante A05 e B06 fornece revisão/publicação. As 27 UFs permanecem condição de conclusão do épico, não condição antecipada de B02. [B07 · #216](https://github.com/stefancabral-oss/presidencia-duelo/issues/216) entrega prontidão operacional e ensaio em staging, sem exigir piloto live para sua conclusão. Evidências de produção e os sete dias são produzidos durante [A05 · #227](https://github.com/stefancabral-oss/presidencia-duelo/issues/227) e exigidos para concluí-la, nunca como pré-requisito para iniciar o release piloto.

Dependências são pré-requisitos de execução e aceite; criar a issue não exige implementá-los. Nenhuma etapa dependente é declarada concluída antes dos gates aplicáveis.

## Regras de execução
- Seguir Issue → branch → PR → CI/testes → HANDOFF → gate humano → encerramento. Não autoaprovar o gate nem marcar a issue completa com itens humanos pendentes.
- O voto continua online-only: leitura, navegação, falha editorial, cache e troca de UF nunca confirmam/cancelam voto, modificam Elo, Espelho, coleção ou escolhem adversário.
- Diretório eleitoral e catálogo do jogo têm universos próprios. Navegação por vínculo pessoal depende de identidade revisada; o app não deduz candidatura pelo nome ou partido.
- Não pedir geolocalização precisa, inferir orientação do leitor, associar histórico de notícias a votos/login ou instalar analytics antes do contrato de privacidade.
- Não armazenar conteúdo editorial protegido, credenciais ou respostas privadas no service worker. Conteúdo retirado não reaparece offline, por cache ou ao voltar no histórico.
- Conteúdo recolhido é dado não confiável; renderizar com escaping/sanitização apropriada e abrir URLs externas com esquema/origem permitidos pelo contrato.
- Flags separadas para diretório e notícias; fallback real do jogo independente. Desligar área não apaga sessão do jogador.
- Não criar agora automação agendada, gastar com provedores, publicar conteúdo ou implantar esta expansão apenas por existir este plano. A execução futura deve documentar responsáveis, ambiente e configuração conforme a autorização vigente.
- Não copiar critérios de completude do piloto para declarar concluída a cobertura das 27 UFs.

## Evidências e handoff
Cada microissue atualiza o CONTEXT, HANDOFF e verification.json do estágio; registrar commit, ambiente, comando, resultado, data e links. Manter separadas evidências planejadas, executadas, pendentes e não aplicáveis. Testes automatizados não equivalem a sessão real de leitor de tela, observação de sete dias ou aprovação editorial. O handoff final inclui flags, rollback ensaiado, cobertura por recorte, versão efetivamente servida e responsáveis humanos.

## Referências de execução

- Frente: [#209](https://github.com/stefancabral-oss/presidencia-duelo/issues/209).
- [Índice desta frente](README.md).
- [Contexto do estágio](../CONTEXT.md).
- [Regras do estágio](../AGENTS.md).
