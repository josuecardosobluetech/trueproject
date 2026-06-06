# Parâmetros dos Mini-Livros Teológicos

Este arquivo define os parâmetros de ajuste fino que controlam como cada mini-livro será gerado. O usuário pode informar os parâmetros desejados ao solicitar um relatório. Se nenhum parâmetro for informado, o sistema deve usar o **Perfil Padrão** definido no final deste arquivo.

---

## Parâmetros Disponíveis

---

### 1. Complexidade

Controla o nível de elaboração dos argumentos teológicos apresentados.

| Nível | Nome | Descrição |
|-------|------|-----------|
| 1 | **Introdutória** | Apenas os conceitos essenciais. Ideal para quem não tem nenhum contato com o tema. Sem debates internos às tradições. |
| 2 | **Acessível** | Conceitos centrais com algum detalhamento. Apresenta as posições principais sem entrar em nuances. Termos técnicos são sempre explicados. |
| 3 | **Moderada** | Inclui as nuances mais relevantes de cada tradição. Apresenta debates internos quando são importantes para entender o tema. |
| 4 | **Avançada** | Explora argumentos detalhados, controvérsias históricas e posições minoritárias. Usa terminologia técnica com explicação integrada. |

---

### 2. Profundidade Histórica

Controla o quanto do percurso histórico do tema será narrado.

| Nível | Nome | Descrição |
|-------|------|-----------|
| 1 | **Panorâmica** | Apenas o contexto de surgimento do tema. Sem rastrear todo o desenvolvimento. |
| 2 | **Moderada** | Cobre os momentos históricos mais decisivos para o tema. |
| 3 | **Profunda** | Rastreia o tema desde a patrística até as formulações modernas, com atenção aos pontos de virada. |
| 4 | **Exaustiva** | Cobre toda a linha histórica, incluindo concílios, documentos, disputas e desenvolvimentos regionais. |

---

### 3. Tipo de Linguagem

Controla o registro linguístico do texto.

| Nível | Nome | Descrição |
|-------|------|-----------|
| 1 | **Conversacional** | Texto leve, quase como uma conversa. Evita termos técnicos ao máximo. |
| 2 | **Acessível** | Linguagem clara e fluida, com termos técnicos sempre explicados. Ideal para leitores curiosos sem formação teológica. |
| 3 | **Semi-técnica** | Usa vocabulário teológico com liberdade, mas mantém clareza. Explica apenas os termos menos conhecidos. |
| 4 | **Técnica** | Linguagem acadêmica. Pressupõe familiaridade com os debates teológicos. Explica apenas termos muito especializados. |

---

### 4. Extensão

Controla o tamanho aproximado do mini-livro gerado.

| Nível | Nome | Descrição aproximada |
|-------|------|----------------------|
| 1 | **Compacto** | 800 a 1.200 palavras. Uma leitura de 5 a 8 minutos. Ideal para uma visão rápida do tema. |
| 2 | **Padrão** | 1.800 a 2.500 palavras. Uma leitura de 10 a 15 minutos. Cobre o tema com equilíbrio. |
| 3 | **Expandido** | 3.500 a 5.000 palavras. Uma leitura de 20 a 30 minutos. Explora o tema com profundidade. |
| 4 | **Mini-livro** | 5.000 a 6.000 palavras. Uma leitura de 30 a 40 minutos. Cobre o tema de forma quase exaustiva, com todas as seções da estrutura desenvolvidas. |
| 5 | **Completo** | 6.000 a 12.000 palavras. Uma leitura de 40 a 80 minutos. Dá uma noção verdadeiramente completa do tema, com desenvolvimento extenso de cada seção, múltiplas perspectivas, debates internos e sínteses aprofundadas. |

> **Regra de conclusão:** Os valores de extensão são alvos mínimos orientadores, não limites rígidos de corte. O texto **nunca deve ser interrompido no meio de uma frase, argumento ou seção**. Se o alvo de palavras for atingido antes de o raciocínio em curso estar concluído, continue até fechar o pensamento com naturalidade. É preferível exceder o alvo em algumas centenas de palavras a entregar um texto truncado.

---

### 5. Foco de Tradição

Controla qual tradição recebe mais atenção e espaço no texto.

| Código | Nome | Descrição |
|--------|------|-----------|
| `equilibrado` | **Equilibrado** | Todas as tradições recebem espaço equivalente. |
| `enfase-catolica` | **Ênfase Católica** | A visão católica e patrística recebe mais desenvolvimento. Útil para entender o que a Igreja ensina. |
| `enfase-reformada` | **Ênfase Reformada** | A visão protestante reformada recebe mais desenvolvimento. |
| `enfase-patristica` | **Ênfase Patrística** | O foco está no que os pais da igreja disseram, com as demais tradições servindo como contexto. |
| `enfase-neutra` | **Ênfase Neutra** | Prioriza os autores não partidários e a análise comparativa. |

---

### 6. Tom do Texto

Controla o registro emocional e intelectual da escrita.

| Código | Nome | Descrição |
|--------|------|-----------|
| `narrativo` | **Narrativo** | Texto fluido e envolvente, quase literário. Prioriza a experiência de leitura. |
| `analitico` | **Analítico** | Foco nos argumentos e na estrutura lógica de cada visão. Menos narrativa, mais raciocínio. |
| `devocional` | **Devocional** | Mantém o rigor teológico, mas conecta o tema à vida espiritual e prática do leitor. |
| `comparativo` | **Comparativo** | O texto é organizado em torno das diferenças e semelhanças entre as tradições. |

---

## Como Usar os Parâmetros

Ao solicitar um relatório, informe os parâmetros desejados no seguinte formato:

```
Tema: [nome do tema]
Complexidade: [1-4]
Profundidade Histórica: [1-4]
Linguagem: [1-4]
Extensão: [1-5]
Foco: [código]
Tom: [código]
```

Se algum parâmetro for omitido, o sistema aplica o valor do **Perfil Padrão** abaixo.

---

## Perfil Padrão

Este perfil foi definido com base nas respostas do questionário e representa a configuração ideal para o usuário atual.

```
Complexidade: 3 — Moderada
Profundidade Histórica: 3 — Profunda
Linguagem: 2 — Acessível
Extensão: 3 — Expandido
Foco: equilibrado
Tom: narrativo
```

> Este perfil pode ser alterado a qualquer momento pelo usuário.
