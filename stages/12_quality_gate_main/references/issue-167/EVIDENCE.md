# Evidência técnica — issue #167

Data: 2026-09-16
Escopo: separar as ações de escolher e conhecer, tornar o coach realmente modal e provar o fluxo completo por teclado.

## Implementação observável

- Cada um dos quatro slots persistentes é um `<article>` com dois `button` irmãos:
  - `.vote-target`, nome acessível `Escolher {nome completo}`;
  - `.profile-trigger`, nome acessível `Conhecer {nome completo}` e texto visível `Conhecer perfil`.
- Não há botão aninhado. O rodapé de perfil mede no mínimo `44px` e ocupa uma linha própria abaixo da carta, sem cobrir retrato ou raridade.
- A pressão longa permanece apenas como atalho de ponteiro sobre o voto.
- O click de ponteiro que encerra a mesma pressão longa é suprimido, mas uma ativação posterior por teclado ou tecnologia assistiva (`detail === 0`) limpa o gesto e escolhe normalmente.
- Durante envio ou recuperação pendente, voto e perfil compartilham o mesmo bloqueio `aria-disabled`; o handler também recusa a abertura do perfil nesses estados.
- O coach inicial é um `<dialog>` aberto com `showModal()`, rotulado por `#coach-title` e focado em `Começar rodada`.
- O perfil é um `<dialog>` nativo sem ação de voto. `Escape`, o botão superior e `Voltar à rodada` fecham o diálogo e devolvem foco ao gatilho exato.
- O retorno de foco valida também a identidade do candidato, evitando focar um nó persistente que já represente outra pessoa.
- Ao sair do coach, e somente nessa transição, o foco vai ao primeiro `.vote-target`.

## Evidência automatizada

`app/e2e/accessible-profile.mjs` executa, em Chromium e WebKit:

1. entrada no duelo e inspeção de `dialog:modal` no coach;
2. tentativa negativa de focar o conteúdo atrás do coach;
3. fechamento por teclado e foco no primeiro voto;
4. inspeção estrutural e geométrica dos quatro artigos em `390×844`;
5. abertura dos quatro perfis com `Enter`, `Space` e `Shift+Enter`, sem trocar a semântica do controle;
6. fechamento por `Escape` e por `Voltar à rodada`, com retorno ao gatilho exato;
7. comparação negativa de contagem, IDs da rodada, ranking e requisições de voto antes/depois dos perfis;
8. pressão longa, `Escape` e `Enter` no mesmo `.vote-target`: zero voto no click de ponteiro e exatamente um voto na ativação de teclado;
9. resposta retida: os quatro perfis ficam `aria-disabled`, não abrem e a rodada não muda enquanto o voto está pendente;
10. voto por `Shift+Enter` no controle explícito de escolha e chegada a uma segunda nova rodada.

Artefatos gerados no mesmo diretório:

- `chromium-390x844.png` e `webkit-390x844.png`: os quatro rodapés visíveis no viewport solicitado;
- `chromium-accessibility.json` e `webkit-accessibility.json`: nomes acessíveis, altura dos rodapés, retorno de foco e invariantes de estado.

## Regressões executadas

- `npm test`: 113/113 (`shared` 4, `back` 39, `app` 70).
- `npm test --prefix app`: 70/70, incluindo a atualização granular dos dois controles persistentes e a distinção entre click de ponteiro e teclado após pressão longa.
- `npm run build --prefix app`: aprovado.
- `interaction-smoke.mjs`: Chromium e WebKit aprovados.
- `responsive-layout.mjs`: 3 telas × 16 viewports, Chromium e WebKit aprovados.
- `vote-recovery.mjs`: sete cenários, Chromium e WebKit aprovados.
- `vote-trust-states.mjs`: estados de confiança, Chromium e WebKit aprovados.
- `accessible-profile.mjs`: Chromium e WebKit aprovados.
- A mensagem longa `Subiu · Em ascensão` é exigida pelo smoke e cabe integralmente no bloco de resultado em `320×568`; a folga vertical específica desse estado evita a diferença de 3 px observada nas fontes do runner Linux, sem reduzir a tipografia ou ocultar conteúdo.

## Limite honesto

A automação prova semântica DOM, modalidade nativa, ordem de foco e uso de teclado nos dois motores. A leitura humana com NVDA e VoiceOver continua pendente e não é declarada aprovada por esta branch.
