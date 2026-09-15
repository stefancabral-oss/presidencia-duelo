# Etapa 11 — Acesso simples com Google

## Pedido aprovado

Adicionar ao PoliMatch um login básico com Google, divertido e sem burocracia, para que a pessoa possa salvar e recuperar o mesmo progresso em mais de um dispositivo.

## Experiência

- Jogar anonimamente continua permitido e é o caminho imediato.
- A entrada com Google é opcional e apresentada como forma de salvar ranking e progresso.
- Não haverá cadastro, senha própria, formulário longo nem bloqueio antes do jogo.
- Depois da entrada, a interface mostra apenas uma confirmação leve e uma identificação compacta da conta.

## Segurança e dados

- O token de identidade do Google é validado exclusivamente no backend.
- A identidade estável é o `sub` validado do Google; e-mail não é usado como chave.
- O token do Google não é persistido.
- O app emite uma sessão opaca própria, armazenando somente seu hash no banco.
- No primeiro acesso, a identidade é ligada ao jogador anônimo atual para preservar escolhas e ranking.
- Uma conta Google já ligada recupera o jogador existente; não há fusão automática de dois históricos.

## Compatibilidade

- Sem `GOOGLE_CLIENT_ID` no backend ou `VITE_GOOGLE_CLIENT_ID` no frontend, o jogo anônimo deve continuar íntegro.
- O deploy só acontece depois da configuração do OAuth para `https://polimatch.com.br` e de um gate humano com uma conta Google real.

## Critérios de aceite

1. O botão oficial do Google aparece numa entrada curta e opcional.
2. O primeiro login preserva o progresso anônimo atual.
3. Um novo dispositivo recupera o mesmo jogador ao entrar com a mesma conta.
4. Credenciais inválidas, expiradas ou destinadas a outro cliente são rejeitadas.
5. Nenhum token do Google é armazenado no frontend após a troca nem no banco.
6. Ausência de configuração não impede o jogo anônimo.
7. Build e testes automatizados passam antes do gate humano.

## Fora de escopo

- Senha própria, recuperação de senha ou cadastro por e-mail.
- Fusão manual de contas e históricos.
- Login obrigatório.
- Outros provedores sociais nesta etapa.
