# Protocolo do teste dos oito — Issue #176

Versão: `card-art-pilot-176-v2`
Estado: `primeiro lote invalidado; regeneração obrigatória antes de qualquer teste humano`

> **Coleta bloqueada.** O lote P01–P08 foi gerado sob `pilot-1`, que exigia fundo uniforme. `pilot-2` passou a admitir gradiente somente depois de as imagens terem sido observadas. A mudança não valida o lote retroativamente: não recrute participantes, não consolide respostas e não registre `seguir` com estes oito arquivos.

## Hipótese

Uma arte editorial uniforme e não caricatural consegue manter reconhecimento suficiente até na cauda do catálogo, no recorte e no tamanho em que a pessoa realmente aparece no jogo, sem comunicar favorecimento político.

## Lote e cegamento

| pessoa | personId | papel no teste |
|---|---:|---|
| Luiz Inácio Lula da Silva | 001 | reconhecimento nacional muito alto |
| Jair Bolsonaro | 063 | reconhecimento nacional muito alto |
| Marina Silva | 033 | reconhecimento nacional alto |
| Michelle Bolsonaro | 028 | reconhecimento nacional médio/alto |
| Tabata Amaral | 084 | reconhecimento político médio |
| Sônia Guajajara | 052 | reconhecimento político médio |
| João Campos | 017 | reconhecimento regional/médio |
| Douglas Ruas | 019 | cauda regional; teste mais difícil |

O lote equilibra quatro mulheres e quatro homens e inclui diferentes regiões, idades, tons de pele, tipos de cabelo, níveis de fama e posições no debate público. Essas categorias orientam a cobertura; não são rótulos exibidos no produto.

Os arquivos invalidados preservados chamam-se somente `P01.png` a `P08.png`. A relação entre código e pessoa fica no manifesto de evidência. Eles não podem ser entregues a participantes. O formulário permanece bloqueado e oferece apenas uma prévia técnica desabilitada para conferir recorte e cegamento.

Cada formulário é fechado sobre uma identidade imutável de lote: `batch.version`, o SHA-256 canônico do manifesto completo e a lista ordenada dos oito pares `blindCode` + SHA-256 da arte. O objeto é congelado recursivamente no navegador e copiado para todo JSON individual. Alterar somente o nome da versão, reutilizar um formulário antigo ou combinar artes de lotes distintos torna a resposta inválida.

## Cenários efetivos de carta

Depois de uma regeneração válida e de o bloqueio ser removido, cada pessoa deverá ver o novo lote inteiro uma única vez, em apenas um cenário. O aplicador balanceará os grupos usando o parâmetro `scenario` do formulário:

- `?scenario=mobile-390x844`: simula o breakpoint de 390 × 844 CSS px pós-#165: carta de 183,5 × 280 px, janela externa de arte de 169,5 × 162 px, imagem de 167,5 × 160 px, placa de 169,5 × 105 px, `object-fit: cover` e topo central;
- `?scenario=desktop-1000x800`: simula o início desktop de 1000 × 800 CSS px: carta de 226 × 316,4 px, janela externa de arte de 206 × 189,4 px, imagem de 204 × 187,4 px, placa de 206 × 109 px, `object-fit: cover` e topo central.

O JSON individual registra todas as larguras e alturas de `viewport`, `card`, `artWindow`, `image` e `blindPlate`, além de `objectFit` e `objectPosition`. O preflight compara **cada campo** à geometria canônica acima com tolerância máxima de 0,2 CSS px; acertar apenas a imagem ou o identificador do cenário não basta.

Enquanto o lote estiver invalidado, o modo normal mostra somente o bloqueio. `technicalPreview=1` permite aos testes automatizados renderizar uma carta, mas mantém todos os campos desabilitados e nunca exporta respostas. O smoke mede o formulário contra uma fixture renderizada com `app/src/styles.css`, a fonte canônica da anatomia da carta; ele não aceita constantes geométricas duplicadas.

Se a anatomia ou os breakpoints mudarem, o smoke falhará até que o formulário e este protocolo acompanhem a fonte canônica. Depois da regeneração, a coleta oficial deverá usar o parâmetro explícito para fechar exatamente os dois estratos.

## Participantes

Esta seção só entra em vigor para um novo lote cujo manifesto tenha `collectionAllowed: true`:

- Mínimo total: 40 adultos que não participaram da geração, curadoria nem revisão das imagens.
- Mínimo por cenário: 20 em `mobile-390x844` e 20 em `desktop-1000x800`.
- Mínimo válido por arte e cenário: cada uma das oito artes precisa conservar pelo menos 20 respostas válidas externas em cada cenário; o número atribuído em `sample.displayScenarios` é um teto, não substitui esse denominador observado.
- Recrutar pessoas de macrorregiões e níveis de familiaridade política variados.
- Não informar quais nomes aparecem antes do teste.
- Não mostrar fotografia de referência, manifesto nem mapeamento dos códigos.
- O consolidado deve trazer `sample.externalRecruitment` com confirmação de que só participaram pessoas externas à produção, responsável e data. A atestação identifica o responsável pela coleta, não os participantes, e não pode conter PII deles.

## Execução cega

Execução suspensa para P01–P08. Após uma regeneração válida:

1. Abrir o formulário com o parâmetro do cenário designado e um receipt aleatório pré-emitido (`?scenario=...&receipt=...`). O receipt é um nonce portador sem identidade e só pode ser usado uma vez.
2. Entregar o dispositivo sem DevTools, explorador de arquivos ou manifesto abertos.
3. Para cada arte, perguntar em campo livre `Quem é esta pessoa?`.
4. Depois da resposta, perguntar se a imagem `favorece`, trata de forma `neutra` ou `prejudica` a pessoa.
5. Não corrigir respostas e não permitir voltar para rever imagens anteriores.
6. Somente depois da oitava imagem, mostrar o disclosure de retrato sintético e coletar familiaridade ampla e macrorregião.
7. Salvar o JSON local. O formulário não envia dados a servidor algum.

Cada JSON individual deve validar contra `card-art-pilot-participant-response.schema.json` e carregar `receipt` e `collectedAt`. Os receipts são gerados antes da coleta; somente seus hashes, em ordem canônica, entram no registro versionado `receipt-registry.json`. O manifesto fixa protocolo, caminho, commit, instante do commit, hash canônico e quantidade emitida. O validador lê os bytes do registro por `git show`, comprova que o commit descende do commit de geração e antecede a primeira coleta e recusa nonce desconhecido ou reutilizado. Assim, renomear uma cópia de resposta não produz uma segunda observação válida.

Antes de contar qualquer resposta, o preflight obrigatório `npm run card-art-pilot:validate-participants --prefix app -- <response-bundle.json>` recebe um objeto que valida contra `card-art-pilot-response-bundle.schema.json`, não um array solto. O bundle contém protocolo, identidade completa do lote, hash do registro e um conjunto **não vazio** de respostas individuais. O preflight recusa formato legado sem `batch`, bundle vazio, resposta/receipt duplicado, código cego ausente/repetido, geometria divergente, fingerprint divergente e qualquer mistura de versão, manifesto ou hashes de arte. Ele permanece fechado enquanto o manifesto não estiver em `pilot-ready-for-human-decision` com `collectionAllowed: true`.

## Privacidade e estratos

- Não coletar nome, e-mail, cidade, estado, IP, organização ou texto livre sobre o participante.
- Familiaridade usa somente `baixa`, `média`, `alta` ou `prefiro não informar`.
- Região usa somente as cinco macrorregiões, `exterior` ou `prefiro não informar`.
- O consolidado não contém respostas textuais nem atributos dos participantes. Ele preserva somente a cadeia de custódia técnica: IDs aleatórios, hashes de receipts, hashes canônicos das respostas, primeira/última coleta e raiz do conjunto.
- Só publicar uma célula regional ou de familiaridade com pelo menos cinco participantes; células menores entram apenas em `suppressedCount`, sem rótulo.
- Não publicar cruzamento região × familiaridade.
- Depois de conferir o consolidado e sua raiz contra o bundle, apagar o bundle e os JSONs individuais usados na agregação; conservar o registro de hashes e o consolidado.
- A validação recusa campos de participante e padrões explícitos de e-mail, CPF, telefone, RG, IPv4/IPv6, endereço e identificação de participante em qualquer texto aninhado. Isso inclui `pessoa`, `voluntária` e `entrevistada` associadas a `mora`, `reside` ou `vive`; logradouros com número, `s/n` ou `sem número`; e CEP formatado ou sem hífen. Controles negativos preservam frases operacionais genéricas sobre participantes externos. A detecção ainda não consegue inferir todo nome próprio arbitrário: revisores humanos continuam proibidos de copiar nomes ou qualquer texto livre dos participantes para `notes`, assinaturas ou justificativa.

## Métricas e limiares

- Reconhecimento por pessoa e cenário: respostas corretas / respostas válidas.
- Nome civil, nome público ou sobrenome inequívoco contam como correto.
- `Não sei` conta como não reconhecido; uma pessoa diferente conta como erro.
- Cada uma das oito pessoas precisa atingir pelo menos 70% em **cada** cenário, não apenas no total combinado.
- Neutralidade: registrar percentuais `favorece`, `neutra` e `prejudica` por imagem.
- Mais de 20% de `favorece` ou de `prejudica`, no total da arte ou em qualquer cenário, impede `seguir` e exige revisão.
- Comparar também o saldo `favorece - prejudica`; discrepância superior a 20 pontos percentuais entre imagens impede a escala.
- Diferença de reconhecimento superior a 15 pontos percentuais entre os dois cenários impede `seguir` e exige revisão de recorte, mesmo quando ambos superem 70%.

## Revisões humanas e decisão

O consolidado deve obedecer a `card-art-pilot-results.schema.json` e conter, para cada código:

- revisão de identidade com `status`, `reviewedBy`, `reviewedAt` e `notes`;
- revisão de dignidade com os mesmos campos;
- contagens brutas e taxas de reconhecimento e neutralidade.

A decisão de um lote válido exige `seguir`, `iterar` ou `abandonar`, acompanhada por `decidedBy`, `decidedAt` e justificativa não vazios. A ordem verificável é `manifest.generatedAt` < primeira coleta ≤ última coleta ≤ atestação ≤ cada revisão ≤ decisão ≤ geração do consolidado. O limite inferior usa o instante exato, não apenas `generatedOn`; nenhum desses eventos pode exceder a janela de 366 dias do lote nem o relógio corrente mais cinco minutos. O relógio é injetável nos testes. O agente que preparou o piloto não pode preencher a amostra, assinar as revisões humanas nem decidir o próprio gate. A CLI `app/scripts/validate-card-art-pilot-results.mjs` valida primeiro a instância completa contra o schema Draft 2020-12 com dependências lockadas, depois executa a semântica, recompõe a custódia a partir do bundle e finalmente comprova a proveniência no histórico Git. Ela recusa qualquer consolidado — inclusive `iterar` ou `abandonar` — salvo com o status canônico `pilot-ready-for-human-decision` e `collectionAllowed: true`, exige proveniência completa das licenças e pelo menos 20 respostas válidas externas por arte e cenário. `scaleDecisionAllowed` é booleano e não pode ser `true` antes da coleta; ele não bloqueia coleta, exportação, `iterar` ou `abandonar`, mas precisa ser `true` para `seguir`, junto dos limiares quantitativos e revisões aprovadas.

Um manifesto pronto também precisa registrar `tool`, `commonPrompt`, `generatedAt`, `generationCommit`, `styleGuideCommitAtGeneration`, `styleGuideSha256AtGeneration` e `styleGuideVersionedAt`. Antes da geração, um generation plan validado por schema deve fixar ferramenta, prompt, guia e, para cada pessoa, a referência com hash, derivação, fonte, autoria e licença; seu commit precisa ser ancestral estrito do commit de geração. No próprio commit de geração, um generation receipt registra o plano, cada `sourceOutput`, caminho final, âncora de estilo, dimensões, hash da arte e os mesmos metadados da referência. O validador usa `git show` nos bytes dos dois documentos e recusa contratos criados depois do fato.

O validador também lê o conteúdo histórico do guia nos commits declarados, confere a versão dentro do arquivo, o SHA-256 com finais de linha normalizados, a ancestralidade estrita, a ordem temporal e os hashes históricos das oito artes e referências. Para coleta autorizada, o guia vigente precisa continuar com o mesmo conteúdo normalizado usado na geração. Assim, repetir rótulos de versão sem o conteúdo e os commits correspondentes não abre o gate. O checkout de CI usa histórico completo para executar essa prova. O lote P01–P08 atual continua inválido justamente porque esses documentos históricos não existiam; a remediação não os fabrica retroativamente.

Além dos limiares, `seguir` continua bloqueado enquanto qualquer referência tiver `licenseStatus: license-pending`. Isso hoje vale para cinco arquivos editados recebidos do usuário; o registro de uma fonte editorial anterior não substitui a licença da fotografia efetivamente usada.

## Registro esperado

Depois da regeneração e da coleta autorizada, os resultados devem ser anexados à issue #176 e copiados para `stages/12_quality_gate_main/output/card-art-pilot-results.json`, validados pelo comando `npm run card-art-pilot:validate-results --prefix app -- <caminho-do-resultado> <response-bundle.json>`. O resultado inclui a custódia recomposta do bundle: hash do registro, contagem, intervalo de coleta, entradas ordenadas por receipt e a raiz SHA-256 canônica do envelope com a identidade do lote. Alterar, omitir, reordenar ou renomear respostas sem preservar seus IDs, receipts e digests faz a validação falhar.

Cada resposta individual, o bundle e a raiz do consolidado incluem `batch.version`, `batch.manifestSha256` e os oito pares ordenados `batch.assets[].blindCode` + `sha256`. O SHA do manifesto é calculado sobre o documento completo com chaves de objeto ordenadas recursivamente, arrays preservados e serialização JSON compacta. O valor canônico do manifesto commitado é obtido por `npm run card-art-pilot:validate-results --prefix app -- --manifest-sha256`. As CLIs recalculam essa identidade; qualquer alteração de versão, status, guia, ordem/conteúdo das artes, pessoa, arquivo, hash, referência ou licença invalida o replay. O arquivo consolidado não existe para o lote invalidado; não se cria resultado vazio ou hipotético.

O formulário bloqueado está em `references/card-art-pilot-176.html`. As oito imagens invalidadas e o manifesto ficam em `evidence/card-art-pilot-176/`, fora de `app/public` e fora do build Vite.
