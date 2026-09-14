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

## Pendente

- Gate visual do shell e do primeiro lote de retratos.
- Tratamento visual e seleção final das fotografias entregues.
- Corrigir ou liberar as 43 fotografias bloqueadas pela auditoria; Cármen Lúcia e Camilo Santana estão explicitamente com pessoa errada e Antonio Rueda depende de autorização.
- Revisão humana das afirmações editoriais e correção dos 54 retratos principais fora do gate.
- Receber os dez retratos individuais do primeiro lote; a colagem de preview não será cortada para produção.
- Resolver as 798 fontes ausentes antes de disponibilizar as respectivas Chromas.
- Reset explícito do PostgreSQL e publicação da página temporária.
- Teste visual em desktop após a entrada das fotografias finais.

## Human gate

Status: nova revisão visual solicitada pelo usuário em 14/09/2026; aguarda aprovação da anatomia premium atualizada antes de publicar.
