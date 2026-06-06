const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const LIB_ROOT = path.join(__dirname, '..');
const REPORTS_DIR = path.join(__dirname, 'reports');
const VIEWER_REPORTS_DIR = path.join(__dirname, '..', 'viewer', 'reports');

if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
if (!fs.existsSync(VIEWER_REPORTS_DIR)) fs.mkdirSync(VIEWER_REPORTS_DIR, { recursive: true });

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODELS = {
  haiku:  'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-6',
  opus:   'claude-opus-4-8'
};

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

/* ─── Helpers de I/O ─── */

function readLibFile(relPath) {
  try { return fs.readFileSync(path.join(LIB_ROOT, relPath), 'utf-8'); }
  catch { return null; }
}

/* ─── RAG: extração de termos ─── */

const STOP_PT = new Set([
  'a','o','e','de','do','da','em','que','nao','se','com','por','para',
  'os','as','um','uma','no','na','ao','dos','das','mas','mais','foi',
  'ser','como','quando','pelo','pela','sua','seu','este','esta','isso',
  'ele','ela','sao','ou','tambem','ja','so','ate','nos','nas','me','te',
  'lhe','qual','quais','seus','suas','aquilo','este','essa','esse','esses',
  'essas','sobre','entre','isso','aqui','ali','tao','muito','pouco','bem',
  'mal','deus','cristo','jesus','que','qual','cada','todo','toda','todos',
  'todas','pode','deve','havia','tinha','tem','ter','ter','estar','estao',
  'esta','tinha','sendo','tendo','sendo','mesmo','outra','outro','outros',
  'outras','proprio','propria','onde','desde','ate','durante','depois',
  'antes','ainda','apenas','porque','pois','entao','assim','tambem'
]);

function extractKeywords(text) {
  return text.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP_PT.has(w))
    .reduce((acc, w) => { if (!acc.includes(w)) acc.push(w); return acc; }, [])
    .slice(0, 25);
}

/* ─── RAG: filtragem do MAPA.md ─── */

function filterMapa(mapaContent, keywords) {
  const lines  = mapaContent.split('\n');
  const header = [];   // cabeçalho + índice temático
  const entries = [];  // entradas individuais de livros
  let current = [];
  let inHeader = true;

  for (const line of lines) {
    if (line.startsWith('## ') && !line.includes('Índice')) inHeader = false;
    if (inHeader) { header.push(line); continue; }
    if (line.startsWith('### ')) {
      if (current.length) entries.push(current.join('\n'));
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length) entries.push(current.join('\n'));

  // Score: conta quantas keywords aparecem em cada entrada
  const scored = entries.map(entry => {
    const norm = entry.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const score = keywords.reduce((s, kw) => s + (norm.includes(kw) ? 1 : 0), 0);
    return { entry, score };
  });

  const topEntries = scored
    .filter(e => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 25)
    .map(e => e.entry);

  // Se não encontrou nada relevante, devolve o índice temático + 15 primeiras entradas
  const selected = topEntries.length > 0
    ? topEntries
    : entries.slice(0, 15);

  return header.join('\n') + '\n\n' + selected.join('\n\n');
}

/* ─── RAG: extração de chunks relevantes de um livro ─── */

function getRelevantChunks(bookPath, keywords, maxChunks = 6) {
  const text = readLibFile(bookPath);
  if (!text) return [];

  const paragraphs = text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 150);

  const scored = paragraphs.map((para, idx) => {
    const norm = para.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    let score = 0;
    keywords.forEach(kw => {
      const n = (norm.match(new RegExp(kw, 'g')) || []).length;
      score += n;
    });
    return { text: para.slice(0, 2000), score, idx };
  });

  return scored
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxChunks)
    .sort((a, b) => a.idx - b.idx) // restaura ordem do documento
    .map(p => p.text);
}

/* ─── Viewer sync ─── */

function regenerateViewerIndex() {
  try {
    const files = fs.readdirSync(REPORTS_DIR)
      .filter(f => f.endsWith('.json'))
      .sort((a, b) => parseInt(b) - parseInt(a));
    const reports = files.map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, f), 'utf-8'));
      return { id: data.id, question: data.question, date: data.date,
               topicCount: data.topicCount, topics: data.topics, parameters: data.parameters };
    });
    fs.writeFileSync(
      path.join(VIEWER_REPORTS_DIR, 'index.json'),
      JSON.stringify({ reports }, null, 2), 'utf-8'
    );
  } catch (err) {
    console.error('[regenerateViewerIndex]', err.message);
  }
}

function autoGitPush(question) {
  const root = path.join(__dirname, '..');
  const msg = `novo relatório: ${question.slice(0, 60).replace(/"/g, "'")}`;
  const cmd = `git -C "${root}" add viewer/reports && git -C "${root}" commit -m "${msg}" && git -C "${root}" push`;
  exec(cmd, (err, _, stderr) => {
    if (err) console.error('[git push]', stderr);
    else console.log('[git push] ok');
  });
}

/* ─── GET /api/reports ─── */

app.get('/api/reports', (req, res) => {
  try {
    const files = fs.readdirSync(REPORTS_DIR)
      .filter(f => f.endsWith('.json'))
      .sort((a, b) => parseInt(b) - parseInt(a));

    const reports = files.map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, f), 'utf-8'));
      return { id: data.id, question: data.question, date: data.date,
               topicCount: data.topicCount, topics: data.topics, parameters: data.parameters };
    });

    res.json({ reports });
  } catch (error) {
    console.error('[GET /api/reports]', error.message);
    res.status(500).json({ error: error.message });
  }
});

/* ─── GET /api/reports/:id ─── */

app.get('/api/reports/:id', (req, res) => {
  try {
    const filePath = path.join(REPORTS_DIR, `${req.params.id}.json`);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Relatório não encontrado.' });
    res.json(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* ─── DELETE /api/reports/:id ─── */

app.delete('/api/reports/:id', (req, res) => {
  try {
    const filePath = path.join(REPORTS_DIR, `${req.params.id}.json`);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Relatório não encontrado.' });
    fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* ─── POST /api/topics ─── */

app.post('/api/topics', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question?.trim()) return res.status(400).json({ error: 'Nenhuma pergunta informada.' });

    const mapaContent    = readLibFile('MAPA.md');
    const contextContent = readLibFile('contexto.md');

    // Filtra o MAPA.md para enviar apenas entradas relevantes
    const keywords    = extractKeywords(question);
    const mapaFiltrado = filterMapa(mapaContent, keywords);

    const systemPrompt = `Você é um assistente de pesquisa teológica especializado em análise comparativa entre catolicismo, protestantismo reformado e patrística.

CONTEXTO DO SISTEMA:
${contextContent}

ÍNDICE FILTRADO DA BIBLIOTECA (entradas relevantes do MAPA.md):
${mapaFiltrado}`;

    const userPrompt = `O usuário tem a seguinte dúvida teológica:
"${question}"

Com base no índice acima, gere uma lista de 8 a 12 tópicos específicos que um mini-livro poderia abordar para responder essa dúvida de forma completa.

Para cada tópico:
- Título claro e direto (5 a 8 palavras)
- Descrição objetiva de uma frase
- Quais tradições têm visão mais relevante
- Caminhos de 2 a 3 arquivos da biblioteca (use os caminhos exatos do campo Arquivo no MAPA.md)

Responda APENAS com JSON válido:
{
  "topics": [
    {
      "id": "1",
      "title": "Título do tópico",
      "description": "O que seria abordado em uma frase.",
      "traditions": ["Catolicismo"],
      "relevantBooks": ["Catolicismo/Nome do arquivo.txt"]
    }
  ]
}`;

    const message = await anthropic.messages.create({
      model: MODELS.sonnet,
      max_tokens: 3000,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userPrompt }]
    });

    const txt = message.content[0].text.trim();
    let parsed;
    try { parsed = JSON.parse(txt); }
    catch {
      const match = txt.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('Resposta inválida da IA ao gerar tópicos.');
      parsed = JSON.parse(match[0]);
    }

    res.json(parsed);
  } catch (error) {
    console.error('[POST /api/topics]', error.message);
    res.status(500).json({ error: error.message });
  }
});

/* ─── POST /api/generate ─── */

app.post('/api/generate', async (req, res) => {
  try {
    const { question, parameters, selectedTopics } = req.body;
    if (!question || !selectedTopics?.length) {
      return res.status(400).json({ error: 'Dados insuficientes para gerar o mini-livro.' });
    }

    const estruturaContent  = readLibFile('estrutura.md');
    const parametrosContent = readLibFile('parametros.md');

    // Coleta livros únicos dos tópicos selecionados
    const bookPaths = new Set();
    selectedTopics.forEach(t => t.relevantBooks?.forEach(b => bookPaths.add(b)));

    // Extrai keywords da pergunta + tópicos para o RAG
    const allText = question + ' ' + selectedTopics.map(t => `${t.title} ${t.description}`).join(' ');
    const keywords = extractKeywords(allText);

    // RAG: busca apenas os parágrafos mais relevantes de cada livro
    let booksContent = '';
    let loaded = 0;
    for (const bookPath of bookPaths) {
      if (loaded >= 5) break;
      const chunks = getRelevantChunks(bookPath, keywords, 6);
      if (chunks.length > 0) {
        booksContent += `\n\n${'='.repeat(60)}\nLIVRO: ${bookPath}\n${'='.repeat(60)}\n`;
        booksContent += chunks.join('\n\n---\n\n');
        loaded++;
      }
    }

    const topicsText = selectedTopics
      .map(t => `• ${t.title}: ${t.description} (${t.traditions.join(', ')})`)
      .join('\n');

    const p = parameters || {};
    const lengthNames = { 1: 'Compacto', 2: 'Padrão', 3: 'Expandido', 4: 'Mini-livro', 5: 'Completo' };
    const maxTokensByLength = { 1: 2500, 2: 4500, 3: 7500, 4: 10000, 5: 16000 };
    const lengthLevel = p.length || 3;
    const paramSummary = `Complexidade: ${p.complexity||3} | Profundidade: ${p.historicalDepth||3} | Linguagem: ${p.language||2} (Acessível) | Extensão: ${lengthLevel} (${lengthNames[lengthLevel]||'Expandido'}) | Foco: ${p.focus||'equilibrado'} | Tom: ${p.tone||'narrativo'}`;

    // Modelo escolhido pelo usuário (padrão: sonnet)
    const modelKey = p.model && MODELS[p.model] ? p.model : 'sonnet';
    const modelId  = MODELS[modelKey];

    const systemPrompt = `Você é um especialista em teologia comparativa com profundo conhecimento da patrística, catolicismo romano, protestantismo reformado e perspectivas não confessionais.

Seu papel é escrever mini-livros teológicos rigorosos, acessíveis e narrativos para um leitor com formação batista/reformada básica que quer entender diferentes tradições sem postura apologética.

ESTRUTURA OBRIGATÓRIA:
${estruturaContent}

REFERÊNCIA DE PARÂMETROS:
${parametrosContent}`;

    const userPrompt = `Escreva um mini-livro teológico completo sobre a seguinte dúvida:
"${question}"

TÓPICOS A ABORDAR:
${topicsText}

PARÂMETROS: ${paramSummary}

TRECHOS RELEVANTES DOS LIVROS DA BIBLIOTECA:
${booksContent || 'Nenhum trecho carregado. Use seu conhecimento teológico como base.'}

INSTRUÇÕES:
1. Siga a estrutura de 7 seções definida
2. Linguagem acessível mas rigorosa, em português brasileiro
3. Explique termos técnicos na primeira ocorrência
4. Cite autores e obras quando usar suas ideias
5. Tom neutro — sem postura católica nem protestante
6. Use ## para seções e ### para subseções
7. Escreva o mini-livro completo, não um esboço
8. Comece diretamente pela primeira seção

Escreva o mini-livro:`;

    const message = await anthropic.messages.create({
      model: modelId,
      max_tokens: maxTokensByLength[lengthLevel] || 8000,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userPrompt }]
    });

    const content = message.content[0].text;

    const reportId = Date.now().toString();
    const reportJson = JSON.stringify({
      id: reportId,
      question,
      date: new Date().toISOString(),
      content,
      parameters: { ...parameters, model: modelKey },
      topicCount: selectedTopics.length,
      topics: selectedTopics.map(t => t.title),
      meta: { model: modelId, chunksLoaded: loaded, keywordsUsed: keywords }
    }, null, 2);

    fs.writeFileSync(path.join(REPORTS_DIR, `${reportId}.json`), reportJson, 'utf-8');
    fs.writeFileSync(path.join(VIEWER_REPORTS_DIR, `${reportId}.json`), reportJson, 'utf-8');
    regenerateViewerIndex();
    autoGitPush(question);

    res.json({ content, id: reportId });
  } catch (error) {
    console.error('[POST /api/generate]', error.message);
    res.status(500).json({ error: error.message });
  }
});


app.listen(PORT, () => {
  console.log(`\n✦ Biblioteca Expandida em http://localhost:${PORT}\n`);
});
