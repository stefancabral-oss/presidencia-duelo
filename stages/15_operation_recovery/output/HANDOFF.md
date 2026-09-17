# Recuperação de fotografias e operação — #202

## Mudança

Restaura 54 fotografias existentes, selecionadas pelo acervo previamente publicado e fixadas por nome, ID, caminho e SHA-256. O estado `restored` identifica a autorização expressa do responsável, sem declarar os perfis aprovados. Textos e classificações ainda pendentes ficam retidos. Fotografias explicitamente rejeitadas não são restauradas.

As cartas priorizam fotografias. Novas edições diárias usam `daily-four-card-v3` / `candidate-public-v3`, preservando a procedência necessária para renderizar as imagens. Snapshots V1/V2 continuam imutáveis. O perfil explica a revisão pendente e liga aos créditos.

A imagem Docker da API agora inclui os arquivos necessários à verificação dos hashes. Health informa ruleset, restauração e revisão embutida quando fornecida no build. Nenhuma migração destrutiva, exclusão de jogador ou reinicialização de votos foi introduzida.

## Evidências locais

- 323 testes unitários passaram.
- Build Vite passou; 54 fotos verificadas por hash; piloto #176 permanece excluído.
- Chromium e WebKit carregaram os arquivos reais nas quatro cartas diárias V3 e no perfil.
- Smoke editorial existente passou no WebKit.
- Verificação de atestações preserva 0 aprovações editoriais: nenhuma foi inventada.

## Operação

A API da main anterior encerrava antes do listen por ausência de `VOTER_NETWORK_SECRET` e `TRUST_PROXY_HOPS`. Foram provisionados no ambiente existente um segredo exclusivo de pseudonimização (sem valor em código/evidências) e um hop para o proxy Traefik do Dokploy. Database URL e login existentes foram preservados.

CI PostgreSQL, merge e validação do release em produção ainda devem ser registrados antes de declarar a recuperação concluída. Não confundir build com container saudável. Verificar `/api/health`, `/api/capabilities`, catálogo de 54 fotos e abertura da sessão no navegador.

## Decisões e pendências

O usuário autorizou restaurar fotos e adiar ilustrações. #176 fica adiada. Isso não aprova biografias, licenças pendentes, taxonomia ou comparação pública agregada. O jogo segue o modo pessoal quando não há autorização verificável para agregados. As demais unidades estão listadas no CONTEXT deste estágio; não estão declaradas concluídas por este patch.
