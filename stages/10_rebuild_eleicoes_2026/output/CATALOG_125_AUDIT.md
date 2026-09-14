# Auditoria e proposta de curadoria — catálogo 125

## Decisão de produto vigente

Manter os 125 nomes no catálogo mestre e separar os assuntos desde o modelo de dados:

- `Eleições 2026`: 100 nomes políticos na curadoria inicial;
- `Influenciadores`: 25 perfis já preparados, ainda não ativados na interface;
- `Escândalos e acontecimentos`: curadorias futuras e independentes.

Assim, influenciadores não são misturados automaticamente com candidatos e agentes políticos no mesmo ranking. Uma pessoa poderá participar de mais de um assunto em uma evolução posterior.

## Qualidade do arquivo recebido

- 125 registros e 125 nomes únicos.
- 100 registros em `politica` e 25 em `influencia_debate`.
- `nome`, `grupo` e `origem`: 100% preenchidos.
- `area` e `por_que`: 25 de 125 registros preenchidos (20%).
- O campo `grupo` não representa corretamente o conteúdo: a lista de política inclui jornalistas, apresentadores, religiosos e influenciadores; a lista de influência inclui pessoas com trajetória ou intenção eleitoral.

Antes da importação, o app deve substituir `grupo` por associações de assunto que aceitem mais de um valor por pessoa.

## Critérios do corte proposto

1. Reconhecimento nacional pelo grande público.
2. Relação direta com a disputa ou o debate de 2026.
3. Capacidade de gerar um duelo compreensível apenas pelo nome e pela fotografia.
4. Redução de redundância institucional, regional ou familiar.
5. Diversidade de correntes políticas, regiões, gêneros e formas de influência.

## Observação

O agrupamento é editorial e funcional, não um julgamento de importância pública. A publicação de cada assunto continua sujeita aos gates visual, fotográfico e editorial.
