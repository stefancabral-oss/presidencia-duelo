# Recuperação de fotografias e operação — #202

## Mudança

Restaura 54 fotografias existentes, selecionadas pelo acervo previamente publicado e fixadas por nome, ID, caminho e SHA-256. O estado `restored` identifica a autorização expressa do responsável, sem declarar os perfis aprovados. Textos e classificações ainda pendentes ficam retidos. Fotografias explicitamente rejeitadas não são restauradas.

As cartas priorizam fotografias. Novas edições diárias usam `daily-four-card-v3` / `candidate-public-v3`, preservando a procedência necessária para renderizar as imagens. Snapshots V1/V2 continuam imutáveis. O perfil explica a revisão pendente e liga aos créditos.

A imagem Docker da API agora inclui os arquivos necessários à verificação dos hashes. Health informa ruleset, restauração e revisão embutida quando fornecida no build. Nenhuma migração destrutiva, exclusão de jogador ou reinicialização de votos foi introduzida.

## Evidências locais

- 324 testes unitários passaram após incorporar a #203 sem conflitos.
- Build Vite passou; 54 fotos verificadas por hash; piloto #176 permanece excluído.
- Chromium e WebKit carregaram os arquivos reais nas quatro cartas diárias V3 e no perfil.
- Smoke editorial existente passou no WebKit.
- Verificação de atestações preserva 0 aprovações editoriais: nenhuma foi inventada.

## Operação

A API da main anterior encerrava antes do listen por ausência de `VOTER_NETWORK_SECRET` e `TRUST_PROXY_HOPS`. Foram provisionados no ambiente existente um segredo exclusivo de pseudonimização (sem valor em código/evidências) e um hop para o proxy Traefik do Dokploy. Database URL e login existentes foram preservados.

## Publicação confirmada

PR #204 mesclada em `8d7a46db4c5eceb3179cf0add0ba6634397d1c66`. Em 17/09/2026 às 04:37 UTC, os registros Dokploy de API e PWA mostraram esse mesmo commit, ambos Done (10s e 18s). O health retornou 200, PostgreSQL saudável, 54 jogáveis e ruleset V3. O campo `revision` permaneceu null: o provedor não passou SOURCE_COMMIT, portanto a identidade foi conferida nos registros dos dois deploys, sem inventar proveniência no endpoint.

Os seis checks do head `6d7501adf5fd3751a4d781b7f726eb54f6f8eca7` passaram: PostgreSQL/abuso, backend/Docker, shared, Design Validator/Docker, Chromium e WebKit. A integração exercitou confirmação, recuperação e idempotência de escolhas.

Uma verificação pública carregou os 54 JPEGs do manifesto: todos responderam 200, image/jpeg e SHA-256 correto. Bundle live `assets/index-8n-4Ufco.js`. O navegador real abriu a rodada 1/10 com quatro fotografias carregadas e nenhum modal bloqueante; o perfil abriu a foto, o aviso de revisão e os créditos, e retornou à rodada. Não foram enviados votos automatizados à produção. API sem porta pública direta no Dokploy; DNS aponta diretamente ao servidor com Traefik.

As capacidades indicam `personal-only`: comparações públicas continuam retidas. A recuperação operacional está concluída. A #202 continua aberta para acompanhar a consolidação das demais unidades na tarefa já solicitada pelo responsável.

Evidência pública: https://github.com/stefancabral-oss/presidencia-duelo/pull/204#issuecomment-5708645598

## Decisões e pendências

O usuário autorizou restaurar fotos e adiar ilustrações. #176 fica adiada. Isso não aprova biografias, licenças pendentes, taxonomia ou comparação pública agregada. O jogo segue o modo pessoal quando não há autorização verificável para agregados. As demais unidades estão listadas no CONTEXT deste estágio; não estão declaradas concluídas por este patch.
