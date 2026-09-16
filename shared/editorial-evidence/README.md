# Evidência editorial interna

Cada prova usada por uma atestação fica em
`<candidateId>/<content|cardArt|documentaryPhoto>/` e é vinculada por SHA-256
dos bytes textuais normalizados e pelo OID do blob Git no commit revisado.

URLs externas não são aceitas diretamente pelo gate. Quando uma fonte externa
for necessária, a revisão deve produzir aqui um registro interno verificável do
material efetivamente conferido; apenas citar uma página mutável não libera uma
publicação.
