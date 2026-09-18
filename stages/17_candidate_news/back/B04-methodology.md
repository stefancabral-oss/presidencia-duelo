# B04 — metodologia editorial proposta, versão 1

Issue [#213](https://github.com/stefancabral-oss/presidencia-duelo/issues/213). Este documento é uma proposta para revisão. Não aprova veículos, classificações, licenças ou coleta em produção.

## Dimensões independentes

Orientação editorial (`right`, `left`, `center`, `mixed`, `unclassified`) é uma classificação institucional revisada, não uma conclusão obtida de uma manchete ou do político criticado. Revisão pode ser `pending`, `approved`, `contested` ou `rejected`. Internacional descreve país/redação originária, não neutralidade ou qualidade. Qualidade exige avaliação própria de apuração, transparência, correções, fontes e distinção entre informação/opinião; não produzir ranking ideológico.

O responsável editorial deve declarar seu nome, corpus e período de avaliação, fontes documentais, critérios aplicados e objeções. Examinar princípios/expediente, editoriais institucionais de períodos distintos e amostra de reportagens sobre o mesmo conjunto de acontecimentos. Reportagem e opinião devem ser avaliadas separadamente. Registrar conclusão motivada e segunda revisão, com próxima revisão em até 90 dias; rever antes disso quando houver mudança de propriedade, redação, princípios ou contestação fundamentada. Não converter autodeclaração isolada em rótulo do produto.

Uma revisão cria uma nova versão do cadastro; snapshots de coleta preservam o cadastro anterior. Não alterar silenciosamente a versão utilizada por uma edição já produzida. Contestação suspende elegibilidade até nova revisão; centro/misto/não classificado não preenchem automaticamente direita/esquerda. A aprovação neste cadastro não equivale à autoridade de publicação de B06.

## Origem, propriedade e direitos

Para cada veículo, confirmar domínio oficial, redação/país, idioma e entidade controladora atual, mantendo URL/data/localizador da evidência. Distinguir editor do site de agência originária e parceiros do mesmo grupo. Número de opções não comprova independência: o relatório expõe também grupos proprietários distintos. Dono ainda desconhecido não comprova independência.

Para cada matéria, registrar autoria, tipo declarado, idioma, origem e sindicação quando fornecidos explicitamente. Se ausentes, manter desconhecidos em observações, sem inferir origem própria. RSS com descrição não comprova leitura/licença do artigo completo. Tradução não muda país da redação nem permite ocultar agência originária.

Autorização de coleta precisa indicar canal/hosts exatos, termos vigentes, licença/acordo, atribuição, responsável pela análise, data, vencimento, conteúdo permitido e retenção. Acesso gratuito, RSS disponível, assinatura de leitura ou licença de outro recurso não substituem essa autorização. Direito de imagem é independente e permanece bloqueado neste coletor. Não contratar ou contatar terceiros automaticamente.

## Cadastro nominal para revisão

[Cadastro estruturado](B04-source-registry.json): Agência Brasil, Brasil de Fato, CartaCapital, Gazeta do Povo, Estadão, BBC News Brasil e Deutsche Welle. Todas as orientações estão não classificadas e pendentes; todos os canais e permissões precisam homologação. Não são opções elegíveis já aprovadas.

| Veículo | Evidência consultada | Limitação registrada |
| --- | --- | --- |
| Agência Brasil | [Índice RSS](https://agenciabrasil.ebc.com.br/feed/) e [termos EBC](https://www.ebc.com.br/termos-de-uso-e-condicoes-gerais-do-portal-da-ebc) | Uso pessoal/sem intuito comercial e atribuição constam dos termos; finalidade e escopo da aplicação exigem revisão |
| Brasil de Fato | [Quem somos](https://www.brasildefato.com.br/quem-somos/) | Rede regional identificada; entidade jurídica, licença, canal e correções ainda não comprovados |
| CartaCapital | [Direitos](https://www.cartacapital.com.br/politica-de-privacidade/) e [manifesto próprio](https://www.cartacapital.com.br/editora/cartacapital/) | Reprodução exige autorização escrita; texto cita Confiança e rodapé Basset, exigindo confirmação da entidade atual |
| Gazeta do Povo | [Expediente](https://www.gazetadopovo.com.br/expediente/), [princípios](https://www.gazetadopovo.com.br/principios-editoriais/) e [termos](https://www.gazetadopovo.com.br/termos) | GRPCOM/redação em Curitiba identificados; acordo de ingestão não homologado |
| Estadão | [FAQ do acervo](https://acervo.estadao.com.br/faq/) | Resultado indexado indica licenciamento de reprodução; leitura direta indisponível, evidência parcial não autoriza ingestão |
| BBC News Brasil | [Página de termos atuais](https://www.bbc.com/pages/terms-of-use) e [documento oficial de 2022](https://downloads.bbc.co.uk/usingthebbc/bbc_terms_of_use_19September2022english.pdf) | Página atual bloqueada por robots; documento histórico não comprova licença vigente do produto |
| Deutsche Welle | [Descrição institucional de 2025](https://corporate.dw.com/de/%C3%BCber-die-deutsche-welle/a-71848692) e [serviço de parceria](https://amp.dw.com/en/benefit-from-smart-content-made-in-germany/a-19470839) | Origem alemã/Bonn e Berlim documentada; canal português e acordo do caso concreto não homologados |

Direita: zero opções elegíveis; esquerda: zero; internacional: zero. BBC/DW são candidatas à revisão de origem internacional; isto não as torna aprovadas. A meta continua duas opções elegíveis por espaço, com substitutos, acesso e independência documentados. Não associar os demais candidatos a um espaço antes da revisão editorial. Insuficiência permanece explícita no [relatório executado](../output/B04-pilot-report.json).

## Registro do aceite

O responsável revisa o cadastro concreto por veículo e informa correções, orientação/revisão, corpus/evidências, fonte da metodologia, canal autorizado e termos aplicáveis. Condições de uso e eventuais custos precisam de confirmação própria. Orientação, qualidade, origem, autorização e aprovação da edição têm registros separados. Até lá, coletor e piloto permanecem em staging e #213 permanece aberta.
