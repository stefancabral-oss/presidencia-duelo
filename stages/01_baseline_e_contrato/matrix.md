# Matriz tela -> componente -> estado -> teste

| Tela/área | Componente | Estados críticos | Teste obrigatório |
|---|---|---|---|
| Duelo | Card | normal, pending, win, lose, erro, raridade | toque simples, duplo toque, foto ausente, texto longo |
| Duelo | VS/Pular | normal, foco, mobile estreito | não sobrepor browser chrome; pular sem votar |
| Duelo | Progresso/Combo | meta em andamento, meta atingida, combo | não cobrir cartas; feedback compacto |
| Duelo | Tópico | ativo/inativo, lista longa | scroll horizontal e troca durante sessão |
| Navegação | Tabs | ativa/inativa/foco | troca sem perder estado; área segura no iPhone |
| Botões | Primary/Secondary/Ghost/Icon | normal, hover, pressed, disabled, loading | contraste, foco, altura mínima, sem saltos de layout |
| Áudio | Toggle | on/off/persistido | sem autoplay indevido; preferência persiste |
| Áudio | Eventos | tap, select, success, error, reward, ranking | sem sobreposição; neutro entre pessoas |
| Ranking | Lista | loading, vazio, completo, mudança de posição | ordenação, atualização, textos longos |
| Ranking | Feedback | líder, top 3, subida, lanterna | linguagem neutra e baseada em estado |
| Torneio | Card | normal, locked, selected | duplo clique registra uma escolha |
| Torneio | Reinício | primeira confirmação, confirmar, cancelar | sem `confirm()` nativo bloqueante |
| Coleção | Grid | todas, chroma, regular, vazio | catálogo grande, filtros e mobile |
| Coleção | Card detail | regular/chroma/suprema/comemorativa | bio/atuação/origem/descrição cabem sem compressão |
| PWA | Inicialização | online, API parcial, offline | não quebrar; não redirecionar voto para Ranking |
| API | Voto | sucesso, timeout, confirmação desconhecida, 409 | cards recuperam; idempotência preservada |
| Deploy | Produção | build, start, health, commit | confirmar commit publicado + smoke funcional |

## Invariantes

1. Votar é tocar na carta.
2. Nenhuma tela depende de som para ser compreendida.
3. Chroma tem mais destaque que regular; o shell não compete com a carta.
4. Feedback de líder/lanterna é simétrico por estado e não por identidade.
5. A interface deve continuar utilizável em viewport estreita sem reduzir o card a uma miniatura ilegível.
