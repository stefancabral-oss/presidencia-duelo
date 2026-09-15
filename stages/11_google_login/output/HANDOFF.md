# HANDOFF — ICM 11

## Status

- Estado: `pronto para configuração e gate`
- Issue: https://github.com/stefancabral-oss/presidencia-duelo/issues/160
- Branch: `feat/google-login-160`
- PR: a preencher após publicação da branch
- Último commit: a preencher após commit

## Entregue

- Entrada opcional `Salvar jogo` no cabeçalho, compacta no celular.
- Painel curto, leve e não bloqueante; `Continuar jogando` preserva o caminho anônimo.
- Botão oficial do Google Identity Services quando o Client ID público está configurado.
- Validação do ID token no backend com a biblioteca oficial e audiência fixada no Client ID.
- Vínculo pelo `sub` validado do Google, sem usar ou armazenar e-mail.
- Preservação idempotente do jogador anônimo e de seu ranking no primeiro login.
- Recuperação do mesmo jogador por uma nova sessão em outro aparelho.
- Sessões PoliMatch opacas, com apenas hash no PostgreSQL, validade de 90 dias e logout revogável.
- Token Google descartado após a troca e nunca persistido.
- Fallback seguro: sem configuração Google, o jogo anônimo continua funcionando.

## Não entregue / pendente

- Criar ou selecionar no Google Cloud um OAuth Client ID do tipo aplicação Web.
- Autorizar `https://polimatch.com.br` como origem JavaScript.
- Configurar `GOOGLE_CLIENT_ID` na API e `VITE_GOOGLE_CLIENT_ID` como build arg do app no Dokploy.
- Executar o gate humano com uma conta real antes do deploy público.

## Testes executados

- Backend: 22 testes unitários aprovados.
- Frontend: 39 testes unitários aprovados.
- Build de produção aprovado com e sem Client ID público.
- PostgreSQL isolado: progresso anônimo preservado no primeiro login, retorno pela mesma identidade, sessão recuperável e logout revogável.
- Chromium e WebKit: login opcional ausente de bloqueio e fluxo completo com provedor simulado; rodada de quatro e ranking permaneceram íntegros.
- Evidência visual: `login-optional-mobile.png`.

## Riscos conhecidos

- O login real não pode ser validado nem publicado sem o Client ID pertencente ao projeto Google do PoliMatch.
- Alterações futuras de domínio exigirão inclusão explícita da nova origem no cliente OAuth.

## Decisões tomadas

- Login não é requisito para jogar.
- Nenhuma senha própria ou formulário de cadastro será criado.
- E-mail não é necessário para a função e não é coletado pelo backend.
- Uma conta já ligada recupera seu jogador; históricos distintos não são fundidos automaticamente.

## Próximo passo exato

1. Configurar o Client ID real nas duas variáveis, reconstruir app/API e testar `https://polimatch.com.br` com uma conta Google real.

## Human gate

- Decisão: `pendente`
- Responsável: Stefan Cabral
- Observação: aprovar o login real e o painel móvel antes do deploy público.
