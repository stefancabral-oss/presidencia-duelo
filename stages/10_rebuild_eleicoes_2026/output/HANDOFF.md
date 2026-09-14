# HANDOFF — ICM 10

## Status

Estado: revisão visual em andamento

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

## Pendente

- Gate visual do shell e do primeiro lote de retratos.
- Tratamento visual e seleção final das fotografias entregues.
- Corrigir ou liberar os 31 espaços ainda sem fotografia; Cármen Lúcia e Camilo Santana seguem explicitamente com pessoa errada e Antonio Rueda depende de autorização.
- Revisão humana das afirmações editoriais e correção dos 54 retratos principais fora do gate.
- Receber os dez retratos individuais do primeiro lote; a colagem de preview não será cortada para produção.
- Resolver as 798 fontes ausentes antes de disponibilizar as respectivas Chromas.
- Reset explícito do PostgreSQL e publicação da página temporária.
- Teste visual em desktop após a entrada das fotografias finais.
- Gate visual das quatro Chromas demonstrativas e do lote de 35 retratos antes de convertê-las em itens equipáveis.
- Confirmar a publicação do novo logo PoliMatch em produção após o deploy manual no Dokploy.

## Human gate

Status: usuário autorizou em 14/09/2026 seguir com as 35 artes usando o tamanho real de exibição como critério. Integração demonstrativa pronta, aguardando avaliação visual final no app. Não publicada.
