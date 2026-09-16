# Evidência editorial interna

Cada decisão usa exatamente um `review.json` em
`<candidateId>/<content|cardArt|documentaryPhoto>/`. O arquivo segue
`editorial-evidence-v1`, repete candidato/dimensão/sujeito, cobre todos os itens
obrigatórios e aponta para capturas em `references/`. Registro livre ou texto
arbitrário não é evidência.

`review.json` e cada captura são vinculados por SHA-256 textual e OID do blob no
commit revisado. Só modos Git `100644`/`100755` e arquivos atuais regulares são
aceitos; symlinks falham. URL externa é apenas metadado e exige captura interna
imutável do material conferido. Citar uma página mutável nunca libera publicação.
