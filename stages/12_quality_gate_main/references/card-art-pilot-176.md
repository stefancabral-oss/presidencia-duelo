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

## Cenários efetivos de carta

Depois de uma regeneração válida e de o bloqueio ser removido, cada pessoa deverá ver o novo lote inteiro uma única vez, em apenas um cenário. O aplicador balanceará os grupos usando o parâmetro `scenario` do formulário:

- `?scenario=mobile-390x844`: simula o breakpoint de 390 × 844 CSS px pós-#165: carta de 183,5 × 280 px, janela externa de arte de 169,5 × 162 px, imagem de 167,5 × 160 px, placa de 169,5 × 105 px, `object-fit: cover` e topo central;
- `?scenario=desktop-1000x800`: simula o início desktop de 1000 × 800 CSS px: carta de 226 × 316,4 px, janela externa de arte de 206 × 189,4 px, imagem de 204 × 187,4 px, placa de 206 × 109 px, `object-fit: cover` e topo central.

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

1. Abrir o formulário com o parâmetro do cenário designado ao participante.
2. Entregar o dispositivo sem DevTools, explorador de arquivos ou manifesto abertos.
3. Para cada arte, perguntar em campo livre `Quem é esta pessoa?`.
4. Depois da resposta, perguntar se a imagem `favorece`, trata de forma `neutra` ou `prejudica` a pessoa.
5. Não corrigir respostas e não permitir voltar para rever imagens anteriores.
6. Somente depois da oitava imagem, mostrar o disclosure de retrato sintético e coletar familiaridade ampla e macrorregião.
7. Salvar o JSON local. O formulário não envia dados a servidor algum.

## Privacidade e estratos

- Não coletar nome, e-mail, cidade, estado, IP, organização ou texto livre sobre o participante.
- Familiaridade usa somente `baixa`, `média`, `alta` ou `prefiro não informar`.
- Região usa somente as cinco macrorregiões, `exterior` ou `prefiro não informar`.
- O consolidado não contém registros individuais, horários, identificadores nem respostas textuais.
- Só publicar uma célula regional ou de familiaridade com pelo menos cinco participantes; células menores entram apenas em `suppressedCount`, sem rótulo.
- Não publicar cruzamento região × familiaridade.
- Depois de conferir o consolidado, apagar os JSONs individuais usados na agregação.
- A validação recusa campos de participante e padrões explícitos de e-mail, CPF, telefone, RG, IPv4/IPv6, endereço e identificação de participante em qualquer texto aninhado. Ela não consegue inferir todo nome próprio arbitrário: revisores humanos continuam proibidos de copiar nomes ou qualquer texto livre dos participantes para `notes`, assinaturas ou justificativa.

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

A decisão de um lote válido exige `seguir`, `iterar` ou `abandonar`, acompanhada por `decidedBy`, `decidedAt` e justificativa não vazios. A cronologia verificável é atestação/revisões ≤ decisão ≤ geração do consolidado; nenhuma dessas datas pode anteceder a data civil real de `manifest.generatedOn` nem exceder a janela de 366 dias do lote. A data do manifesto não pode anteceder o guia versionado nem estar no futuro além de 24 horas de tolerância de relógio. O agente que preparou o piloto não pode preencher a amostra, assinar as revisões humanas nem decidir o próprio gate. A CLI `app/scripts/validate-card-art-pilot-results.mjs` valida primeiro a instância completa contra o schema Draft 2020-12 com dependências lockadas e só então executa a semântica. Ela recusa qualquer consolidado — inclusive `iterar` ou `abandonar` — salvo com o status canônico `pilot-ready-for-human-decision` e `collectionAllowed: true`, exige proveniência completa das licenças e pelo menos 20 respostas válidas externas por arte e cenário. `scaleDecisionAllowed` é booleano e não pode ser `true` antes da coleta; para `seguir`, precisa ser `true` e também bloqueia reconhecimento inferior a 70%, diferença entre cenários superior a 15 pontos percentuais, `favoreceRate` ou `prejudicaRate` superior a 20% ou revisão não aprovada.

Além dos limiares, `seguir` continua bloqueado enquanto qualquer referência tiver `licenseStatus: license-pending`. Isso hoje vale para cinco arquivos editados recebidos do usuário; o registro de uma fonte editorial anterior não substitui a licença da fotografia efetivamente usada.

## Registro esperado

Depois da regeneração e da coleta autorizada, os resultados devem ser anexados à issue #176 e copiados para `stages/12_quality_gate_main/output/card-art-pilot-results.json`, validados contra o schema e pelo comando `npm run card-art-pilot:validate-results --prefix app -- <caminho-do-resultado>`. A raiz do resultado inclui `batch.manifestSha256`, calculado sobre o manifesto completo com chaves de objeto ordenadas recursivamente, arrays preservados e serialização JSON compacta. O valor canônico do manifesto commitado é obtido por `npm run card-art-pilot:validate-results --prefix app -- --manifest-sha256`. A CLI recalcula esse SHA-256; qualquer alteração de versão, status, guia, ordem/conteúdo das artes, pessoa, arquivo, hash, referência ou licença invalida o replay. O arquivo consolidado não existe para o lote invalidado; não se cria resultado vazio ou hipotético.

O formulário bloqueado está em `references/card-art-pilot-176.html`. As oito imagens invalidadas e o manifesto ficam em `evidence/card-art-pilot-176/`, fora de `app/public` e fora do build Vite.
