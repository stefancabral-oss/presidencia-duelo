# ICM 16 — entrega consolidada das issues abertas

Em 17/09/2026 Stefan solicitou: “Me entregue uma PR sem conflitos com todas as
issues prontas”. Esta autorização permite desenvolver as unidades dependentes
na mesma branch e submetê-las em uma PR, substituindo a sequência de PRs
individuais para esta entrega. Não significa aprovação editorial, assistiva,
jurídica ou de arte, nem autorização para inventar evidência humana.

Base: main após #203. Escopo: #151, #156, #166, #167, #171, #173, #175,
#176, #177, #180, #181, #182, #183, #184 e #202. Implementações já integradas
serão preservadas e verificadas; arte nova está adiada conforme #202.

## Decisões antes da implementação

- Fotografias existentes substituem ilustrações na recuperação. O catálogo
  editorial completo continua exigindo revisão; não promover registros pending.
- Coleção gratuita: uma recompensa por sessão diária concluída, persistida
  idempotentemente. Sem pagamento, patrocínio, raridade de político ou galeria
  de demonstração confundida com inventário. A política comercial não é parecer
  jurídico e sua ativação pública depende do gate da #183.
- Descarte opcional é dado separado e não altera Elo nem soma derrotas. Somente
  a escolha principal influencia o ranking; completude é medida por sessão.
- Duas cartas são modos explícitos de aquecimento e desempate, com rodada
  emitida pelo servidor, ID persistente e migração declarada. Quatro continuam
  sendo o núcleo; nenhum endpoint binário legado é ressuscitado.
- Espelho usa somente dados estruturados e comportamento observado na sessão,
  sem inferir ideologia, gênero ou outros atributos sensíveis. Comparação com
  terceiros só pode usar corte fechado e autoridade de publicação existente.
- Elo permanece na API. Feedback para a pessoa usa escolhas, confrontos e
  posições compreensíveis. Zebra deve comparar o vencedor ao melhor da mesa.

## Aceite

PR sem conflitos, testes proporcionais (incluindo PostgreSQL e navegador), CI
verde, matriz por issue, handoff e verification com resultados observados.
Não fechar automaticamente issues cujo aceite humano ou deploy não foi feito.
