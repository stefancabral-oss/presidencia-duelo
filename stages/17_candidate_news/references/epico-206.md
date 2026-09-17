## Objetivo e resultado esperado

Adicionar ao PoliMatch duas áreas de consulta: **“Conheça seu candidato”**, para entender quem concorre, com quem concorre e o que propõe; e **“Notícias”**, com uma edição diária que permita comparar como veículos de direita, de esquerda e internacionais cobrem o mesmo acontecimento.

A pessoa deve conseguir escolher sua UF, consultar uma chapa completa, comparar propostas com fontes e abrir a cobertura jornalística relacionada. A leitura é pública, sem login obrigatório, e não altera votos, Elo, Espelho, coleção ou seleção de adversários.

Esta é uma **issue de produto/épico**, criada a pedido de Stefan após modelagem por saturação. Registra o desenho e os critérios para implementação futura; não representa funcionalidade construída, aprovação editorial nem deploy. As frentes devem ser entregues em PRs delimitadas, respeitando o processo ICM.

## 1. Decisões centrais

1. Prioridade: Presidência e vice-presidência; governos das 26 UFs e do DF e seus vices; Senado e **1º e 2º suplentes de cada candidatura**. Senado não tem vice. A quantidade de vagas por eleição deve vir de configuração/dados oficiais, não de um valor fixo no código. Em 2026 são duas vagas de senador por UF. [Fonte: TSE](https://www.tse.jus.br/comunicacao/noticias/2026/Janeiro/confira-quais-cargos-estarao-em-disputa-nas-eleicoes-2026).
2. O diretório eleitoral tem universo próprio, identificado pela eleição/cargo/circunscrição. O catálogo de personalidades do jogo não comprova candidatura e não limita quem aparece no diretório.
3. Notícias são agrupadas por **acontecimento**, não apenas por nome de político ou palavra-chave. As três coberturas precisam se referir ao mesmo fato e período.
4. “Direita” e “esquerda” descrevem uma classificação editorial documentada do veículo; “internacional” descreve sua origem editorial. São dimensões diferentes, e nenhuma delas constitui selo de verdade ou neutralidade.
5. Cada acontecimento terá três espaços explícitos: direita, esquerda e internacional. Quando uma cobertura não for localizada, mostrar a lacuna e a última verificação. Nunca fabricar resumo, reaproveitar matéria sem relação ou ocultar uma notícia local só para exigir três links.
6. Conteúdo informativo mantém apresentação equivalente e referências verificáveis. A ordenação não usa preferência política inferida, popularidade no jogo, intenção de voto ou pagamento.

## 2. Experiência e navegação

- Criar rotas próprias para as duas abas, com links diretos e funcionamento de voltar/avançar do navegador.
- No mobile, usar rótulos curtos “Candidatos” e “Notícias”; o título da primeira página é “Conheça seu candidato”.
- Proposta inicial de navegação: Início, Jogar, Candidatos, Notícias e Mais. Ranking e Coleção continuam acessíveis em Mais e por atalhos nas respectivas jornadas. Validar essa reorganização no protótipo, sem simplesmente acrescentar seis botões à barra atual.
- Escolha manual de UF, com opção Brasil para Presidência e notícias nacionais; não solicitar localização precisa. A preferência pode ficar apenas no dispositivo.
- A ficha acessada durante o jogo deve preservar a rodada e devolver o foco ao controle de origem. Notícias e fichas não confirmam nem cancelam escolhas.
- Textos legíveis, hierarquia malaquita/porcelana já aprovada, fotografias documentais, teclado, foco visível, leitor de tela, zoom e estados de carregamento/erro/vazio.
- Sem votação, curtidas ideológicas, comentários públicos, publicidade política ou recomendação de “melhor candidato” nesta entrega.

## 3. Aba “Conheça seu candidato”

### Descoberta

Filtros por eleição, UF/circunscrição, cargo, partido e situação oficial da candidatura; busca por nome civil/nome de urna e número. Ordem inicial alfabética, com critério de desempate estável. Apresentar contagem e cobertura do recorte selecionado.

Mostrar todas as candidaturas oficiais do recorte publicado, inclusive partidos pequenos. Situações como pedido de registro, deferimento, indeferimento, recurso, renúncia ou substituição devem preservar a denominação da fonte e a data de referência, sem transformar uma situação provisória em conclusão definitiva. Registros históricos permanecem consultáveis e identificados.

Pré-candidatura, personalidade do jogo e candidatura registrada são entidades distintas. Uma pessoa que só existe no jogo não ganha automaticamente número, cargo disputado ou status eleitoral.

### Ficha em camadas

| Bloco | Conteúdo mínimo |
| --- | --- |
| Identificação | Nome de urna, nome público completo quando pertinente, foto com origem/crédito, partido/federação/coligação conforme fonte, cargo, UF, número e situação oficial com data |
| Chapa | Titular e vice, ou titular e dois suplentes ordenados; cada integrante com ficha própria e ligação de retorno |
| Quem é | Resumo factual curto e trajetória com cargos e períodos, apenas com fontes aprovadas |
| O que o cargo faz | Explicação acessível das atribuições, com fonte institucional; separar competência do cargo de promessa de campanha |
| Propostas | Saúde, educação, segurança, economia, infraestrutura/meio ambiente e outros temas pertinentes; texto original referenciado, resumo e página/seção/data |
| Transparência | Links oficiais para candidatura, bens declarados e prestação de contas; exibir período e natureza declaratória quando houver valores resumidos |
| Contexto atual | Notícias vinculadas à pessoa/chapa, com data e o mesmo padrão de perspectivas da aba Notícias |
| Fontes e correções | Referências por afirmação, última atualização, histórico relevante de alteração e ação “Informar um erro” |

Para Executivo, priorizar plano de governo oficialmente disponibilizado. Para Senado, usar programa/documento ou declaração pública identificada quando disponível, sem exigir um documento que a fonte não oferece e sem inferir posição pela legenda. “Não localizado na fonte consultada” é diferente de “não possui proposta”.

Separar proposta anunciada, voto parlamentar registrado, medida executada e resultado observado. Não converter promessa em realização nem atribuir causalidade automaticamente. Comparações de desempenho parlamentar, processos e avaliações de execução ficam para uma ampliação com metodologia própria; nesta primeira entrega não haverá “nota de honestidade” ou dossiê automático de acusações.

### Comparação

- Comparar de duas a três candidaturas **do mesmo cargo, eleição e circunscrição**, escolhidas explicitamente pelo usuário.
- Aplicar os mesmos temas, limites de texto e visibilidade de fontes a todas.
- Permitir expandir a composição completa de cada chapa.
- Exibir “sem informação publicada/validada” quando necessário, sem preencher por IA.
- Não produzir ranking de qualidade, recomendação eleitoral ou percentual de afinidade nessa tela.

### Integridade dos dados

Usar dados oficiais do [Portal de Dados Abertos do TSE](https://dadosabertos.tse.jus.br/dataset/candidatos-2026) e links do DivulgaCandContas como base da candidatura. O dataset disponibiliza recursos para candidaturas, bens, coligações, vagas, fotos e propostas, com metadados de geração. Dados financeiros exigem a referência temporal da prestação: a consulta não é uma auditoria nem aprovação de contas. [Contexto do TSE sobre a prestação parcial](https://www.tse.jus.br/comunicacao/noticias/2026/Setembro/tse-disponibiliza-dados-da-prestacao-de-contas-parcial-das-campanhas-eleitorais).

Cada fato publicável precisa de URL/origem, localizador no documento quando aplicável, data da fonte, data de consulta, versão e estado de revisão. Fonte de campanha deve ser identificada como declaração da campanha.

Importação não equivale a aprovação editorial. Preservar os controles de publicação de #171 e a proveniência de #173; projetar um contrato versionado próprio para o diretório, sem promover biografias pendentes nem forçar dados eleitorais no schema do jogo.

Manter fotos existentes apenas quando identidade, origem e permissão de uso forem compatíveis. Para novos candidatos/vices/suplentes, importar fotografias autorizadas e revisar identidade. Ausência de foto usa placeholder neutro; não impede publicar informação válida. Ilustrações continuam adiadas conforme a decisão de Stefan.

## 4. Aba “Notícias”: um acontecimento, coberturas comparáveis

### Edição diária

- Publicar edição identificada por data em America/Sao_Paulo, com visão Brasil e filtro por UF/tema; arquivo das edições anteriores.
- Alvo inicial de 5–10 acontecimentos nacionais por dia, ajustável à capacidade editorial. Quantidade não é obrigação de inventar pauta.
- Cobertura estadual entra por piloto declarado e expansão gradual. Mostrar quais UFs têm cobertura editorial; nunca sugerir cobertura nacional completa quando ela não existe.
- Cada cartão informa título factual, o que aconteceu, por que é relevante, data do acontecimento, última atualização e quantidade de perspectivas disponíveis.
- Ordenação por critérios públicos de interesse público, impacto, atualidade e diversidade temática/regional. Registrar justificativa das pautas escolhidas. Não ordenar por indignação, preferência inferida ou desempenho de candidatos no jogo.

### Página do acontecimento

1. **O que está documentado:** síntese curta com fontes primárias pertinentes e atribuição. Um comunicado oficial pode documentar uma declaração, sem provar sozinho o fato declarado.
2. **Como foi coberto:** três cartões de tamanho equivalente, com veículo, autor quando disponível, manchete original, tipo de conteúdo, país, idioma, data/hora, breve resumo atribuído e link original.
3. **O que muda entre as coberturas:** diferenças de enfoque, evidências utilizadas e pontos não resolvidos; convergência não prova verdade e divergência não torna todas as alegações igualmente sustentadas.
4. **Contexto e cronologia:** antecedentes e atualizações claramente separados do fato do dia.
5. **Pessoas e chapas relacionadas:** vínculo por identidade revisada, sem tratar mera menção como endosso ou envolvimento em irregularidade.
6. **Correções e transparência:** versões, retirada/correção, responsável pela revisão e metodologia de seleção.

Os três cartões são “Veículo classificado à direita”, “Veículo classificado à esquerda” e “Cobertura internacional”. “Internacional” deve considerar a redação responsável e seu contexto editorial, não apenas domínio estrangeiro ou idioma inglês.

Uma mesma matéria não preenche dois espaços. Republicações da mesma agência não contam como três apurações independentes. Registrar autoria original, sindicação e grupo proprietário; procurar diversidade editorial real e explicitar relações relevantes. Se houver uma única apuração, não apresentar o conjunto como confirmação independente.

Disponibilidade parcial: manter os três espaços e marcar o ausente como “Cobertura não localizada nas fontes monitoradas até [hora]”. Distinguir ausência, falha de coleta, acesso restrito e item em revisão. Não chamar ausência no monitoramento de “silêncio da imprensa”. Novas fontes podem completar a cobertura depois, com revisão versionada.

### Seleção e classificação dos veículos

Criar cadastro de fontes antes da publicação automática, contendo nome, domínio oficial, país da redação, idioma, grupo proprietário, autoria/sindicação, RSS/API/acordo de uso, termos/licença e política de correções.

A classificação editorial deve ter critérios publicados, evidências, responsável, data, versão e revisão periódica; aceitar centro, misto, não classificado e contestado. Não classificar veículo a partir de uma manchete isolada, do tema da matéria ou do político criticado. Um rótulo contestado não pode ser arbitrariamente realocado para completar um espaço.

Para o piloto, levantar **ao menos duas opções elegíveis para cada espaço**, com possibilidade de substituição. A lista nominal e a metodologia são entregáveis, não premissas já aprovadas nesta issue. Qualidade jornalística, transparência e adequação ao acontecimento são avaliadas separadamente da orientação.

Separar notícia, reportagem, análise, opinião e conteúdo patrocinado. No piloto, conteúdo patrocinado fica fora; opinião/análise podem aparecer com rótulo explícito, sem serem resumidas como fato. A transparência sobre autoria, propriedade, fontes e tipo de conteúdo é inspirada nos [indicadores do Trust Project](https://thetrustproject.org/faq/); isso não implica certificação nem fornece, por si só, classificação esquerda/direita.

### Direitos e uso de IA

Priorizar RSS/APIs licenciados, feeds permitidos e curadoria de links. Não contornar paywall ou copiar artigos completos. Resumos próprios devem ser breves, fiéis ao material efetivamente acessível e acompanhados do original. Se só houver manchete acessível, não gerar resumo do corpo que não foi lido.

Fotos e miniaturas precisam de permissão compatível; na ausência dela, usar apresentação textual. Traduções devem ser sinalizadas e preservar acesso ao original.

IA pode sugerir agrupamento e rascunhos com referências, mas não publicar sozinha, atribuir orientação sem revisão ou transformar alegação em fato. Tratar páginas coletadas como dados não confiáveis: instruções presentes nelas nunca comandam o sistema.

## 5. Modelo de dados e integração

Modelo conceitual, sujeito ao desenho técnico da implementação:

- **Pessoa:** identidade estável e vínculo opcional com personId do jogo; homônimos precisam de desambiguação.
- **Candidatura:** eleição, identificador oficial, pessoa, cargo, circunscrição, número, partido/coligação, situação e vigência. Identificadores de candidaturas não são reutilizados entre eleições.
- **Chapa/composição:** titular, vice ou suplentes com ordem, intervalo de vigência, fonte e histórico de substituição. Não associar vice/suplente apenas por coincidência de partido.
- **Afirmação/proposta:** tema, tipo de afirmação, texto, fonte/localizador, versão e revisão.
- **Veículo:** identidade editorial, país, propriedade, classificação versionada e condições de uso.
- **Matéria:** URL canônica, veículo/redação de origem, autor, tipo, idioma, datas, acesso/licença e situação.
- **Acontecimento:** identidade, tema/UF, janela temporal, síntese revisada e fontes primárias.
- **Cobertura:** ligação entre acontecimento e matéria, espaço editorial, versão da classificação e justificativa de pertinência.
- **Edição/publicação:** data, versão, itens, responsável e trilha de correções.

Fluxo proposto: coleta/importação → normalização e deduplicação → verificação de identidade/acontecimento → rascunho → revisão → publicação versionada → monitoramento/correção.

Reutilizar frontend Vite/JavaScript e backend existentes, com módulos e endpoints paginados próprios. Importadores e agendamento rodam fora da requisição de jogo. Falha em fonte de notícias não pode derrubar rodada, login ou ranking.

Migrações precisam preservar snapshots históricos e estados do jogo. Publicação atômica, reprocessamento idempotente, limites de concorrência, timeout/retry, logs sem dados pessoais desnecessários e proteção da coleta contra URLs internas, redirects indevidos e HTML executável.

Leitura pública anônima; escrita editorial autenticada e auditada. Preferências políticas e histórico de leitura não alimentam segmentação política. Métricas agregadas mínimas, sem associação a votos ou identidade Google; revisar coleta/retenção antes de ativar analytics.

## 6. Operação e atualização

Parâmetros iniciais propostos, a confirmar no piloto com medição real:

- Sincronizar candidaturas até quatro vezes ao dia conforme disponibilidade da origem, registrar a geração do arquivo e revisar mudanças antes de publicar.
- Coletar notícias periodicamente com limite por fonte; preparar uma edição diária às 08h de Brasília e permitir atualizações revisadas ao longo do dia.
- Metas de frescor: dados eleitorais com mais de 24h sem sincronização e edição do dia não publicada até 10h geram aviso operacional e indicação pública de desatualização. Diferenciar coleta recente de publicação editorial antiga.
- Sem responsável disponível, manter a última edição com sua data real; não renomear notícia antiga como “hoje”. Exibir motivo de indisponibilidade sem inventar conteúdo.
- Ter responsável editorial e substituto, fluxo “Informar um erro”, prioridade para correções materiais e registro público das alterações. Identificar donos e disponibilidade no piloto.
- Fontes indisponíveis não apagam automaticamente candidatos; usar a última versão válida com aviso. Conteúdo retirado por erro não reaparece por cache/PWA.
- Feature flags independentes para diretório e notícias; desligar uma área preserva o jogo.
- Medir custo de provedores/IA, armazenamento e tempo de edição em piloto de sete dias. Definir teto mensal e limite de trabalho diário a partir dessa medição; suspender novas coletas/runs pagos ao atingir o teto, preservando leitura. Não presumir operação gratuita nem orçamento aprovado.

## 7. Entrega incremental e dependências

| Frente | Entrega | Condição de avanço |
| --- | --- | --- |
| A — Contratos e protótipo | Universo eleitoral, relações de chapa, política de fontes, desenho de navegação e registro de decisões | Revisão do responsável de produto/editorial |
| B — Diretório piloto | Presidência completa e pelo menos uma UF piloto completa para governo/Senado, inclusive vices/suplentes; ficha e comparação | Reconciliação com fonte oficial, QA e cobertura publicada |
| C — Notícias piloto | Cadastro de fontes, edição diária, três espaços, ausência transparente e correções | Sete dias de operação observada e revisão editorial |
| D — Expansão | Diretório de todas as 27 UFs; operação diária estável; cobertura estadual de notícias expandida e declarada | Critérios de aceite abaixo atendidos e deploy verificado |

A UF piloto será definida por viabilidade de cobertura e declarada no lançamento; não selecionar somente candidatos conhecidos. A conclusão do piloto não encerra a cobertura nacional do diretório prevista neste épico.

Dependências/relações:
- #171: publicação e revisão editorial.
- #173: taxonomia/proveniência.
- #166 e #167: DOM/foco e perfil acessível.
- #202 e #176: fotografias documentais restauradas; ilustrações adiadas.
- #205: coordenar a base e navegação com a consolidação de jogo, sem misturar esta expansão à PR existente.
- #21: catálogo de personalidades é contexto histórico; seu critério de notoriedade não se aplica à inclusão no diretório eleitoral.

Entregáveis técnicos futuros seguem AGENTS.md: branch/PR, CI proporcional, CONTEXT do estágio, HANDOFF, verification.json, revisão humana e confirmação de deploy. Esta issue não fecha automaticamente essas dependências.

## 8. Critérios de aceite

- [ ] As duas áreas são navegáveis por URL, celular, teclado e leitor de tela, com voltar/avançar e retorno à rodada preservados.
- [ ] O diretório cobre Presidência e todas as 27 UFs para governo/Senado; cada recorte informa total oficial na data, total publicado e lacunas. Nenhuma omissão silenciosa.
- [ ] A completude do diretório é calculada sobre **candidaturas oficiais do recorte**, separada de completude de fotos, biografias, propostas e notícias. Placeholder ou texto pendente não exclui candidatura validada.
- [ ] Vice e ambos os suplentes possuem vínculos e fichas próprios; substituição, homônimos, mudança de partido e histórico entre eleições não geram associações falsas.
- [ ] Campos factuais publicados possuem proveniência e revisão; dados pendentes, ambíguos e desatualizados são tratados explicitamente.
- [ ] Comparação de duas/três candidaturas usa o mesmo recorte, temas e espaço, sem recomendação ou ranking ideológico.
- [ ] Todo acontecimento tem três espaços; os preenchidos apontam para matérias realmente relacionadas, e os ausentes explicam o estado e horário da verificação.
- [ ] Internacional, orientação editorial, qualidade da fonte e tipo da matéria são dimensões separadas, com metodologia acessível.
- [ ] Sindicação, paywall, opinião, tradução, correção e retirada têm tratamento verificável.
- [ ] Conteúdo editorial e importação têm revisão, auditoria, idempotência e rollback; cache não ressuscita conteúdo retirado.
- [ ] Publicação diária opera durante sete dias consecutivos de piloto; registrar horários, quantidade, lacunas, falhas, correções, custo e esforço, inclusive dias sem edição nova.
- [ ] Falhas/desligamento das novas áreas não alteram votos, rankings, Espelho, coleção ou disponibilidade do jogo.
- [ ] Não há coleta de localização precisa, inferência de ideologia do leitor ou ordenação baseada nas escolhas do jogo.
- [ ] Revisão humana do piloto, CI, HANDOFF, evidências e smoke test em produção registrados antes do encerramento.

## 9. Testes e evidências a produzir

Cenários funcionais: presidente+vice; governador+vice; senador+dois suplentes; candidatura sem foto; dado pendente; candidato não presente no jogo; homônimos; substituição de vice; alteração de status com recurso; eleição anterior; UF sem conteúdo editorial extra; propostas ausentes; comparação com seleção incompatível.

Cenários de notícias: três coberturas válidas; ausência internacional em fato local; fonte fora do ar; paywall; mesma agência republicada; opinião com rótulo; matéria antiga com título atualizado; dois fatos distintos sobre a mesma pessoa; traduções; classificação contestada; correção posterior; data virando em Brasília; dia sem nova edição.

Evidências técnicas: integração com fixtures oficiais versionadas; testes de importação, deduplicação e publicação; URLs/HTML maliciosos; controle editorial; reprocessamento; cache/retirada; Chromium/WebKit; teclado/zoom/leitor de tela; regressão dos fluxos de jogo. Os cenários acima são plano de teste, **não testes executados nesta modelagem**.

Revisão de produto: participantes devem conseguir localizar o vice/suplentes, comparar duas propostas e reconhecer qual cobertura falta e quais textos são opinião. Registrar observações reais e corrigir problemas; não tratar uma simulação de IA como pesquisa com usuários.

Indicadores: cobertura por cargo/UF, frescor, proporção de fatos com fonte, temas com 3/2/1 perspectivas, diversidade de redações, correções, links quebrados, tempo de publicação e custo. Não otimizar por mudança de intenção de voto. Metas numéricas adicionais dependem da linha de base do piloto.

## 10. Loop de saturação realizado antes de abrir a issue

Método: revisão documental iterativa do desenho. A cada rodada, confrontar o modelo com uma classe diferente de falhas e consolidar a decisão. Encerrar após duas passagens sem novo problema estrutural que altere objetivo, entidades ou escopo inicial. Isso não substitui validação editorial, técnica ou com usuários.

| Rodada | Questão examinada | Decisão incorporada |
| --- | --- | --- |
| 1 — Necessidade e universo | Quem entra e o que significa “seus vices”? | Separar diretório e jogo; incluir chapas executivas e dois suplentes senatoriais; cobrir todos os registros do recorte |
| 2 — Evidência e comparação | Dados ausentes, candidatura provisória, proposta versus realização | Proveniência por afirmação, status temporal, comparação equivalente e ausência explícita |
| 3 — Perspectivas | Internacional seria neutro? Toda notícia terá três coberturas? | Separar dimensões; três espaços sem fabricação; preservar notícias locais com lacunas |
| 4 — Independência e atualização | Três links repetem uma agência? E paywall, notícia velha ou retratação? | Origem editorial/sindicação, acesso real ao conteúdo, agrupamento temporal e histórico de correções |
| 5 — Operação e integração | Como sustentar publicação diária sem quebrar o jogo? | Piloto de sete dias, responsável/substituto, orçamento medido, falhas isoladas, feature flags e navegação proposta |
| 6 — Completude e casos extremos | Foto ausente exclui alguém? Troca de vice altera histórico? Site fora do ar apaga candidatura? | Denominadores separados, composição versionada, última versão válida e conteúdo desatualizado identificado |
| 7 — Contraprova editorial | Fato local sem cobertura externa; fonte mista; acusação contradita; cópia de agência | Políticas de lacuna, revisão/classificação, atribuição e independência já cobrem os casos; sem nova mudança estrutural |
| 8 — Contraprova operacional | Virada do dia, editor ausente, importação repetida, rollback e consulta durante voto pendente | Contratos de data, publicação revisada, idempotência e isolamento já cobrem os casos; sem nova mudança estrutural |

**Resultado:** desenho suficientemente definido para decomposição técnica e prototipação. Permanecem decisões de implantação: veículos elegíveis, responsáveis editoriais, UF piloto, condições de uso dos provedores, orçamento e evidências reais de usabilidade. São entregáveis identificados, não fatos presumidos.

## 11. Fora de escopo inicial

Deputados, eleições municipais, intenção de voto, recomendação personalizada de candidato, pontuação ideológica de usuários, comentários/rede social, propaganda, cobrança, push automático, transmissão de vídeo, ilustrações novas e publicação jornalística inteiramente autônoma.

A implementação pode preparar extensibilidade para outros cargos/eleições sem prometer sua cobertura nesta entrega.

## 12. Gate humano

- [ ] Responsável de produto valida navegação, clareza e separação entre jogo e informação.
- [ ] Responsável editorial valida amostra das fichas, classificação de veículos, agrupamento e comparações de cobertura.
- [ ] Uso das fontes, operação/custos e correções possuem responsáveis e condições documentadas.
- [ ] Usuários reais e revisão assistiva confirmam os fluxos centrais.
- [ ] Aceite e eventuais ressalvas registrados no HANDOFF, sem aprovação humana simulada por agente.

