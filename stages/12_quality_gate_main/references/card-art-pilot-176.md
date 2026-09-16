# Protocolo do teste dos oito — Issue #176

## Hipótese

Uma arte editorial uniforme e não caricatural consegue manter reconhecimento suficiente até na cauda do catálogo sem comunicar favorecimento político.

## Lote

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

O lote equilibra quatro mulheres e quatro homens e inclui diferentes regiões, idades, tons de pele, tipos de cabelo, níveis de fama e posições no debate público. Essas categorias orientam a cobertura do teste; não são rótulos exibidos no produto.

## Participantes

- Mínimo: 20 adultos que não participaram da geração, curadoria nem revisão das imagens.
- Recrutar pessoas com níveis variados de interesse em política.
- Não informar quais nomes aparecem antes do teste.
- Não mostrar a fotografia de referência junto da ilustração.

## Execução cega

1. Embaralhar a ordem das oito artes para cada participante.
2. Mostrar cada arte sem nome, partido, cargo, moldura ou texto.
3. Perguntar em campo livre: `Quem é esta pessoa?`.
4. Depois da resposta, perguntar: `A imagem parece favorecer, prejudicar ou tratar de forma neutra esta pessoa?`.
5. Registrar uma justificativa curta opcional, sem corrigir a resposta.
6. Só ao final perguntar a familiaridade do participante com política em escala de 1 a 5.

## Métricas e limiares

- Reconhecimento por pessoa: respostas corretas / respostas válidas.
- O nome civil, nome público ou sobrenome inequívoco contam como correto.
- `Não sei` conta como não reconhecido; uma pessoa diferente conta como erro.
- Cada uma das oito precisa atingir pelo menos 70% de reconhecimento.
- Neutralidade: registrar percentuais `favorece`, `neutra` e `prejudica` por imagem.
- Revisão obrigatória se mais de 20% perceber favorecimento ou mais de 20% perceber prejuízo em qualquer imagem.
- Comparar também o saldo `favorece - prejudica`; discrepância superior a 20 pontos percentuais entre imagens impede a escala.

## Registro esperado

Os resultados devem ser anexados à issue #176 e copiados para `output/card-art-pilot-results.json`, sem dados pessoais dos participantes. O arquivo deve conter tamanho da amostra, contagens brutas por imagem, taxas calculadas, observações e a decisão `seguir`, `iterar` ou `abandonar`.

## Estado atual

`lote gerado; aguardando teste humano externo`.

O formulário offline randomizado está em `card-art-pilot-176.html`. Ele exporta um JSON local por participante e não envia dados a servidor algum.

Nenhum agente pode preencher resultados hipotéticos nem aprovar o próprio gate.
