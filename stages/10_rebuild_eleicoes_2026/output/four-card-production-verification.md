# Evidência de produção — rodada de quatro cartas

- Verificação: 2026-09-15T03:20:00-03:00 a 2026-09-15T03:29:07-03:00
- Commit de produto publicado: `86e071bffc8b567376eb75cd5f80782a2a8eded8`
- Pull Request: https://github.com/stefancabral-oss/presidencia-duelo/pull/146
- Aplicações: API e PWA com estado `done` no painel de produção, ambas apontando para o commit acima.
- O painel foi verificado sem registrar URLs privadas de webhook ou credenciais neste artefato.

## Saúde pública da API

Comando reproduzível:

```sh
curl --fail --silent --show-error https://api.polimatch.com.br/api/health
```

Saída observada:

```json
{"ok":true,"service":"polimatch-api","database":"postgresql","candidates":125,"playableCandidates":54,"activeTopics":1}
```

## Bloqueio do duelo binário legado

Comando reproduzível e sem mutação de estado:

```sh
curl --silent --show-error --write-out '\nHTTP %{http_code}\n' -X POST https://api.polimatch.com.br/api/vote -H 'Content-Type: application/json' -d '{}'
```

Saída observada:

```text
{"error":"duelos binários foram substituídos por rodadas de quatro; atualize o aplicativo","code":"ROUND_V4_REQUIRED"}
HTTP 410
```

## Interface pública

URL verificada com cache busting: `https://polimatch.com.br/?release=86e071b`.

No navegador de produção, a ação `Começar agora` abriu a tela `Escolha uma entre quatro`. O DOM acessível continha exatamente quatro botões de carta, cada um com imagem e instrução de toque/pressão longa, além da ação separada `Nenhuma destas · trocar as quatro`. Nenhuma escolha foi confirmada durante a verificação para não alterar o ranking público.

Evidência visual equivalente do layout validado em Chromium e WebKit: `four-card-round-mobile-qa.png`.
