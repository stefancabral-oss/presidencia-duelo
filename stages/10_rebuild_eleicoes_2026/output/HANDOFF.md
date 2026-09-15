# HANDOFF — ICM 10

## Status

Estado: rodada principal de quatro cartas e endurecimento técnico publicados; gates visuais amplos do estágio ainda pendentes

- Issue principal: https://github.com/stefancabral-oss/presidencia-duelo/issues/143
- Pull Request principal: https://github.com/stefancabral-oss/presidencia-duelo/pull/144
- Correções da revisão: https://github.com/stefancabral-oss/presidencia-duelo/issues/145
- Pull Request das correções: https://github.com/stefancabral-oss/presidencia-duelo/pull/146
- Identidade sonora: https://github.com/stefancabral-oss/presidencia-duelo/issues/151
- Pull Request da identidade sonora: https://github.com/stefancabral-oss/presidencia-duelo/pull/152
- Navegação Início/Duelo: https://github.com/stefancabral-oss/presidencia-duelo/issues/154
- Commit das correções validadas e publicado: `86e071b`
- Commit da implementação principal publicado: `bceac93`
- Evidência pública sanitizada: `four-card-production-verification.md`
- Captura sanitizada do painel: `four-card-deployments-sanitized.txt`

## Entregue

- Contexto atualizado para a reconstrução Eleições 2026.
- Frontend legado removido do ramo novo; histórico preservado no Git.
- Diretórios duplicados `front/` e `app/` consolidados em um único app.
- Shell novo criado com assuntos, duelo, ficha, ranking e coleção.
- Primeiro contrato do backend documentado.
- Aplicação continua online-only e só confirma o voto após resposta da API.
- Backend convertido de modos fixos para assuntos editoriais.
- `Eleições 2026` é o único assunto ativo; expansões permanecem bloqueadas.
- Ranking geral e ranking pessoal usam tabelas separadas por assunto.
- Migração única prepara o reset seguro dos dados antigos na primeira publicação.
- Catálogo técnico reconstruído com 125 registros: 100 políticos em `Eleições 2026` e 25 influenciadores preparados para o assunto seguinte.
- As três peças `Malaquita 2026 / Digital First` foram registradas como direção de arte aprovada.
- O shell foi ajustado para malaquita escura, ouro de progressão, placas claras e molduras facetadas.
- Modelo de Chroma separado em catálogo, inventário pessoal e equipamento por pessoa/assunto.
- Novas Chromas poderão ser publicadas continuamente sem interferir no ranking.
- Smoke real em PostgreSQL temporário comprovou reset único, persistência após reinício, voto idempotente e rankings geral/pessoal.
- O duelo é contínuo; nenhuma quantidade de escolhas redireciona automaticamente para o ranking.
- A interface possui sons neutros para entrada, navegação, perfil, escolha, confirmação, troca de rodada e erro; todos são sintetizados localmente, só começam após interação e podem ser desligados por um controle persistente no cabeçalho.
- A ficha educativa aceita biografia, dados-chave e fontes revisáveis; campos ausentes aparecem como revisão pendente, sem conteúdo inventado.
- Rankings não atribuem posição ou `0%` enganoso a pessoas que ainda não participaram de duelos.
- Teste mobile real em 390 × 844 validou cinco escolhas contínuas sem abertura automática do ranking, feedback de `+Elo`, pressão longa abrindo a ficha sem votar e ausência de erros no navegador.
- Recebidos e preservados como entrada os catálogos de 125 perfis e 375 referências fotográficas.
- Auditoria reproduzível confirmou cobertura completa de nomes e apontou 54 retratos neutros ainda fora do gate de publicação.
- As 375 imagens-fonte foram baixadas em 125 pastas, três por pessoa, com manifesto, crédito, licença declarada e checksum.
- O pacote técnico foi validado sem arquivos ausentes ou checksums divergentes e entregue fora do app para tratamento.
- Três referências inválidas de Antonio Rueda foram substituídas por retratos identificáveis e explicitamente marcadas como uso restrito.
- Os 125 perfis editoriais foram convertidos para o catálogo canônico com 507 referências e estado `pending`.
- As cinco partes de Chromas foram validadas: 1.500 registros, 12 por pessoa, todos mantidos como `draft` e separados da carta padrão.
- O gate encontrou 702 Chromas com URL de fonte e 798 ainda dependentes de uma fonte verificável.
- O pacote de 125 fotos tratadas foi auditado: dimensões e arquivos estão íntegros, mas o relatório contém 17 revisões manuais, 20 flags técnicas e 19 flags de licença.
- Somente 82 retratos sem qualquer flag foram integrados à prévia; 43 permanecem em fallback para impedir publicação acidental de pessoa errada, baixa qualidade ou licença pendente.
- O duelo móvel foi reorganizado em duas cartas grandes empilhadas; em desktop, as duas cartas permanecem grandes e lado a lado.
- Cada carta recebeu uma camada atmosférica entre retrato e moldura, integrando as bordas à malaquita, e uma última camada de verniz que cobre foto, placa e estrutura com reflexo controlado.
- Após o feedback de que a primeira composição ainda parecia uma foto com borda, a carta básica foi reconstruída como um objeto em camadas: aro metálico externo, trilhos internos, cantos facetados, retrato rebaixado, placa de nome encaixada e verniz superficial. O tratamento continua deliberadamente abaixo das Chromas em intensidade.
- Capturas de QA em WebKit foram preservadas em `mobile-stacked-photo-qa.png` e `desktop-photo-qa.png`.
- O primeiro preview de dez retratos em caricatura editorial foi registrado como direção operacional, aguardando os arquivos individuais.
- O primeiro acesso ao duelo agora apresenta uma explicação curta e descontraída; depois de concluída, ela não reaparece no mesmo navegador.
- O pareamento usa um baralho embaralhado por sessão, cobrindo o elenco antes de repetir pessoas e evitando que alguém reapareça imediatamente no duelo seguinte.
- A carta escolhida recebe realce enquanto o servidor confirma o voto, sem antecipar o resultado.
- O ranking geral e pessoal ganhou pódio, busca por nome ou partido e exibição inicial limitada a 25 posições, com abertura opcional da lista completa.
- A busca do ranking ignora acentos e foi validada no viewport móvel.
- A Coleção recebeu um laboratório visual com quatro Chromas demonstrativas: Lula e Renan Santos em Suprema de três estrelas e Comemorativa de estrela prismática.
- As quatro cartas usam hologramas distintos: feixes dourados, anéis metálicos, fragmentos prismáticos e aurora espectral.
- O reflexo responde ao ponteiro/toque; no celular, um botão solicita a permissão necessária para acompanhar a inclinação do aparelho.
- O movimento é neutralizado quando `prefers-reduced-motion` está ativo e as demonstrações continuam separadas do inventário real.
- A captura `chroma-collection-mobile-qa.png` registra a prévia no viewport de iPhone.
- A primeira tentativa de reproduzir o acabamento premium apenas com CSS foi rejeitada após comparação direta com os mockups aprovados.
- O laboratório passou a usar quatro artes completas renderizadas: Lula e Renan Santos em Suprema de três estrelas e Comemorativa prismática; moldura, retrato, raridade e placa agora pertencem à própria arte.
- O app aplica somente verniz e trajetórias leves de brilho sobre as artes, preservando rosto, nome e símbolos no Safari móvel.
- As imagens de produção da prévia foram pré-dimensionadas em 530 × 742 e JPEG de alta qualidade para evitar moiré na redução do WebKit e manter carregamento móvel controlado.
- A captura `chroma-collection-mobile-qa-v2.png` registra a nova composição no viewport de iPhone com as quatro artes completas.
- A carta básica passou a incorporar nome, partido ou área, função atual, resumo curto e a dica `Segure para conhecer` dentro da própria placa; o botão externo de perfil foi removido.
- Os 125 perfis possuem slots estáveis de retrato em `app/public/portraits/001.jpg` até `125.jpg`; substituir o JPG e gerar uma nova build não exige alterar o componente ou o catálogo.
- A versão dos retratos muda automaticamente a cada build, evitando que Safari ou CDN mantenham uma fotografia anterior em cache.
- O validador `portraits:check` reconhece atualmente 94 retratos presentes e 31 espaços aguardando imagem; ausência ou falha mantém o fallback por iniciais.
- O padrão de entrega das fotos foi documentado em `docs/design/PHOTO_SLOTS.md` e a captura `mobile-basic-card-photo-slots-qa.png` registra a carta básica no viewport de iPhone.
- O lote pessoal `Arquivo.zip` substituiu os retratos de 35 pessoas do catálogo, preservando exatamente o tratamento escolhido pelo usuário em conversões JPG sRGB 800 × 1000, sem ampliação artificial.
- O mapeamento auditável está em `docs/design/USER_EDITED_PHOTOS.md`; `Jair Bolsonaro Filho.tif` foi preservado sem aplicação porque retrata Jair Renan, ausente do catálogo, e a segunda alternativa de Flávio Bolsonaro permaneceu como opção não aplicada.
- A captura WebKit `mobile-user-edited-photos-qa.png` comprova as fotos enviadas pelo usuário nos cards de Lula e Renan Santos, mantendo informação, malaquita e verniz separados da imagem-fonte.
- O primeiro lote aprovado de retratos Chroma foi integrado ao laboratório da Coleção: 35 pessoas do catálogo, seis exemplos iniciais e abertura opcional da lista completa.
- A carta básica continua sendo o padrão, e as novas artes permanecem fora do inventário, do sorteio e do equipamento nesta etapa.
- Os mestres em PNG foram preservados fora do app; derivados móveis em JPEG 600 × 750 somam aproximadamente 4 MB e carregam sob demanda.
- A segunda arte de Flávio Bolsonaro foi preservada como alternativa sem criar uma pessoa duplicada; Jair Renan permaneceu fora do app por não integrar o catálogo atual.
- Cada retrato Chroma informa que é arte editada por IA e recebe moldura, placa, verniz e holograma como camadas independentes da interface.
- WebKit e Chromium abriram as 35 imagens durante rolagem real; a prévia mantém uma carta grande por linha no celular e duas por linha no desktop.
- As capturas `chroma-approved-batch-mobile-qa.png` e `chroma-approved-batch-desktop-qa.png` registram o lote dentro da Coleção.
- O kit final da marca substituiu os losangos provisórios: o símbolo oficial de duas cartas agora aparece no cabeçalho, nas cartas, no onboarding, no favicon e no ícone instalável do PWA.
- Assinaturas outline, editáveis, símbolo flat, monocromático, versão de 24 px, ícone mestre e apresentação volumétrica foram preservados em `app/public/brand/`.
- Os ícones PWA em 192 e 512 px foram derivados do mestre oficial de 1024 px; o manifesto expõe versões vetorial e raster.
- A captura WebKit `final-brand-mobile-qa.png` comprova a leitura do novo símbolo no cabeçalho e dentro das cartas.
- O catálogo público passou a expor somente pessoas com fotografia enviada ou aprovada pelo curador: 40 perfis políticos no assunto ativo e 14 influenciadores já preparados, mantendo os demais registros guardados e inativos.
- Por decisão do usuário em 15/09/2026, os 14 influenciadores preparados também passaram a integrar as rodadas e o ranking da edição principal; o conjunto jogável agora soma 54 perfis com fotografia aprovada.
- A inicialização da API preenche de forma idempotente as estatísticas pessoais ausentes, permitindo que jogadores anteriores votem nos perfis recém-liberados sem perder o histórico.
- Dois lotes recentes foram importados com trilha auditável: 15 novas fotografias públicas e as substituições de Michelle Bolsonaro, Paulo Guedes, Janja, Alexandre de Moraes e André Mendonça; Gabriela Prioli permanece em reserva porque seu assunto ainda não está ativo.
- A página inicial foi reconstruída com o fluxo de design do Sites: proposta do produto, chamadas claras para rodada e ranking, edição ativa, explicação em três passos e próxima edição.
- A vitrine principal usa quatro cartas básicas com exposição rigorosamente igual para Janja, Michelle Bolsonaro, Lula e Jair Bolsonaro; nenhuma delas é apresentada como Chroma especial.
- O QA responsivo confirmou a página inicial em 390 × 844 e 1280 × 900, sem overflow horizontal, imagens quebradas ou erros no console; os dois acessos à rodada e o acesso ao ranking foram exercitados.
- A rodada principal agora apresenta quatro cartas simultâneas e com a mesma exposição: grade 2 × 2 no celular e uma fileira de quatro no desktop.
- Um único toque escolhe a preferida, compara essa pessoa com as outras três para o Elo e abre uma nova rodada com quatro opções; a ação `Nenhuma destas` troca o grupo inteiro sem votar.
- O backend preserva uma rodada imutável e três comparações auditáveis, com idempotência por `roundId`; os indicadores de uso e a versão pessoal avançam apenas uma vez por escolha.
- O texto essencial passou a ficar sobre a própria foto no celular. A pressão longa continua abrindo o perfil completo sem criar botões que disputem espaço com a carta.
- Chromium e WebKit validaram as quatro cartas inteiras em 390 × 844, dimensões iguais, pressão longa, escolha, ranking e disposição em quatro colunas a 1280 × 900.
- A revisão posterior ao PR principal congelou o Elo no snapshot anterior à rodada, ligou as três comparações ao mesmo `roundId`, aposentou votos binários de clientes antigos e corrigiu a nomenclatura do ranking para vitórias e derrotas em comparações.
- O layout passou a responder também à altura útil: as quatro cartas permanecem inteiras em 320 × 568 e a função de cada pessoa continua visível sobre a fotografia.
- A navegação pública foi separada em `Início`, `Duelo` e `Ranking`; tocar em `Duelo` abre diretamente a rodada e `Início` retorna à apresentação do produto.
- Coleção/Chromas foi removida temporariamente da navegação pública por decisão do usuário, preservando código, catálogo e assets para retomada futura.

## Pendente

- Gate visual do shell e do primeiro lote de retratos.
- Tratamento visual e seleção final das fotografias entregues.
- Continuar recebendo as fotografias faltantes; pessoas sem foto enviada ou aprovada permanecem automaticamente fora do app público.
- Revisão humana das afirmações editoriais e correção dos 54 retratos principais fora do gate.
- Receber os dez retratos individuais do primeiro lote; a colagem de preview não será cortada para produção.
- Resolver as 798 fontes ausentes antes de disponibilizar as respectivas Chromas.
- Reset explícito do PostgreSQL e publicação da página temporária.
- Teste visual em desktop após a entrada das fotografias finais.
- Gate visual das quatro Chromas demonstrativas e do lote de 35 retratos antes de convertê-las em itens equipáveis.
- Confirmar a publicação do novo logo PoliMatch em produção após o deploy manual no Dokploy.

## Human gate

Status da entrega principal: usuário autorizou os 54 perfis e a rodada de quatro cartas; Issue #143 e PR #144 foram implementados, mesclados e publicados em 15/09/2026.

Status do endurecimento: as correções de auditoria e responsividade da Issue #145 foram aprovadas, mescladas no PR #146 e publicadas em 15/09/2026 no commit `86e071b`. CI, PostgreSQL isolado real, Chromium e WebKit foram aprovados; a API pública confirmou 54 perfis jogáveis e a interface pública exibiu quatro cartas na mesma rodada. A escrita em produção não foi exercitada para não criar um voto técnico permanente no ranking público sem autorização específica.

Status da navegação: a Issue #154 separa `Início` e `Duelo` e oculta Coleção/Chromas do menu público. A implementação está em revisão humana e ainda não foi publicada.
