# Atestações editoriais

Uma decisão no ledger aponta para exatamente um arquivo
`<candidateId>/<content|cardArt|documentaryPhoto>.json` nesta pasta. O arquivo
segue `editorial-attestation-v1`; exemplos reais só entram após o conteúdo e as
evidências existirem em um commit anterior revisável.

O hash declarado e o histórico Git garantem conteúdo e integridade, não
identidade nem autoridade. A policy versionada apenas confere se `decidedBy`
corresponde ao revisor declarado. Uma decisão só produz aprovação quando o
runtime recebe e verifica um recibo Ed25519 da autoridade externa configurada;
sem recibo, o estado público permanece `pending`/`missing`.
