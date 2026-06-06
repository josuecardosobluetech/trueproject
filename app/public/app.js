/* ─── State ─── */
let currentTopics = [];
let currentReportId = null;
let paginationState = { pages: [], current: 0 };
let readerKeydownBound = false;

function saveProgress(page) {
  if (!currentReportId || page === 0) return;
  localStorage.setItem('p_' + currentReportId, JSON.stringify({ page, total: paginationState.pages.length }));
}

function loadProgress(id) {
  try { return JSON.parse(localStorage.getItem('p_' + id)); } catch { return null; }
}

function saveBookmark(id, page) {
  localStorage.setItem('b_' + id, page.toString());
}

function loadBookmark(id) {
  const v = localStorage.getItem('b_' + id);
  return v !== null ? parseInt(v) : null;
}

function clearBookmark(id) {
  localStorage.removeItem('b_' + id);
}

function toggleBookmark() {
  if (!currentReportId) return;
  const current = paginationState.current;
  const existing = loadBookmark(currentReportId);
  if (existing === current) {
    clearBookmark(currentReportId);
  } else {
    saveBookmark(currentReportId, current);
  }
  updateBookmarkButton();
}

function updateBookmarkButton() {
  const btn = document.getElementById('btn-bookmark');
  if (!btn || !currentReportId) return;
  const bookmarked = loadBookmark(currentReportId);
  const isCurrent = bookmarked === paginationState.current;
  btn.classList.toggle('bookmarked', isCurrent);
  btn.textContent = isCurrent ? '★ Marcada' : '☆ Marcar';
}

const complexityLabels  = ['Introdutória', 'Acessível', 'Moderada', 'Avançada'];
const depthLabels       = ['Panorâmica', 'Moderada', 'Profunda', 'Exaustiva'];
const languageLabels    = ['Conversacional', 'Acessível', 'Semi-técnica', 'Técnica'];
const lengthLabels      = ['Compacto (~1.000 palavras)', 'Padrão (~2.000 palavras)', 'Expandido (~4.000 palavras)', 'Mini-livro (~5.500 palavras)', 'Completo (~8.000–12.000 palavras)'];

const loadingMessages = [
  'Analisando a biblioteca...',
  'Identificando fontes relevantes...',
  'Consultando os textos...',
  'Organizando os tópicos...'
];

const generateMessages = [
  'Selecionando as fontes...',
  'Lendo os textos da biblioteca...',
  'Tecendo as visões teológicas...',
  'Escrevendo o mini-livro...',
  'Finalizando...'
];

/* ─── Utilities ─── */
function showLoading(messages) {
  const el  = document.getElementById('loading');
  const txt = document.getElementById('loading-text');
  el.classList.remove('hidden');
  let i = 0;
  txt.textContent = messages[0];
  const interval = setInterval(() => {
    i = (i + 1) % messages.length;
    txt.textContent = messages[i];
  }, 2800);
  return () => { clearInterval(interval); el.classList.add('hidden'); };
}

function goToStep(n) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById(`step-${n}`).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showError(msg) { alert('Erro: ' + msg); }

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/* ─── Parameters panel ─── */
const useDefaultEl = document.getElementById('use-default');
const paramsPanel  = document.getElementById('params-panel');

useDefaultEl.addEventListener('change', () => {
  paramsPanel.classList.toggle('hidden', useDefaultEl.checked);
});

function bindSlider(id, labels, lblId) {
  const slider = document.getElementById(id);
  const lbl    = document.getElementById(lblId);
  slider.addEventListener('input', () => {
    lbl.textContent = labels[parseInt(slider.value) - 1];
  });
}
bindSlider('sl-complexity', complexityLabels, 'lbl-complexity');
bindSlider('sl-depth',      depthLabels,      'lbl-depth');
bindSlider('sl-language',   languageLabels,   'lbl-language');
bindSlider('sl-length',     lengthLabels,     'lbl-length');

const modelHints = {
  haiku:  'Claude Haiku: mais rápido e barato, bom para temas mais diretos. ~$0,01–0,03 / relatório.',
  sonnet: 'Claude Sonnet: excelente para teologia, ~5× mais barato que Opus. ~$0,05–0,10 / relatório.',
  opus:   'Claude Opus: máxima profundidade analítica, ideal para temas muito complexos. ~$0,30–0,60 / relatório.'
};
const modelCosts = { haiku: '~$0,01–0,03', sonnet: '~$0,05–0,10', opus: '~$0,30–0,60' };

document.getElementById('sl-model').addEventListener('change', function () {
  document.getElementById('model-hint').textContent = modelHints[this.value] || '';
  document.getElementById('lbl-model-cost').textContent = (modelCosts[this.value] || '') + ' / relatório';
});

function getParameters() {
  if (useDefaultEl.checked) {
    return { complexity: 3, historicalDepth: 3, language: 2, length: 3, focus: 'equilibrado', tone: 'narrativo', model: 'sonnet' };
  }
  return {
    complexity:      parseInt(document.getElementById('sl-complexity').value),
    historicalDepth: parseInt(document.getElementById('sl-depth').value),
    language:        parseInt(document.getElementById('sl-language').value),
    length:          parseInt(document.getElementById('sl-length').value),
    focus:           document.getElementById('sl-focus').value,
    tone:            document.getElementById('sl-tone').value,
    model:           document.getElementById('sl-model').value
  };
}

/* ─── Step 1 → Step 2: Generate Topics ─── */
document.getElementById('btn-topics').addEventListener('click', async () => {
  const question = document.getElementById('question').value.trim();
  if (!question) { alert('Por favor, escreva sua dúvida teológica antes de continuar.'); return; }

  const stopLoading = showLoading(loadingMessages);
  try {
    const res  = await fetch('/api/topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, parameters: getParameters() })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao gerar tópicos.');

    currentTopics = data.topics || [];
    renderTopics(currentTopics);
    document.getElementById('step2-question').textContent = `"${question}"`;
    stopLoading();
    goToStep(2);
  } catch (err) { stopLoading(); showError(err.message); }
});

/* ─── Render Topics ─── */
function renderTopics(topics) {
  const grid = document.getElementById('topics-grid');
  grid.innerHTML = '';
  topics.forEach(topic => {
    const card = document.createElement('div');
    card.className = 'topic-card';
    card.dataset.id = topic.id;
    const traditionTags = (topic.traditions || []).map(t => `<span class="tag">${t}</span>`).join('');
    card.innerHTML = `
      <label>
        <input type="checkbox" class="topic-check" value="${topic.id}">
        <div class="topic-body">
          <div class="topic-title">${topic.title}</div>
          <div class="topic-desc">${topic.description}</div>
          <div class="traditions">${traditionTags}</div>
        </div>
      </label>`;
    const checkbox = card.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', () => {
      card.classList.toggle('selected', checkbox.checked);
      updateSelectedCount();
    });
    grid.appendChild(card);
  });
  updateSelectedCount();
}

function updateSelectedCount() {
  const checked = document.querySelectorAll('.topic-check:checked').length;
  document.getElementById('selected-count').textContent =
    checked === 0 ? 'Nenhum tópico selecionado'
    : checked === 1 ? '1 tópico selecionado'
    : `${checked} tópicos selecionados`;
  document.getElementById('btn-generate').disabled = checked === 0;
}

function selectAll() {
  document.querySelectorAll('.topic-check').forEach(cb => {
    cb.checked = true;
    cb.closest('.topic-card').classList.add('selected');
  });
  updateSelectedCount();
}

function deselectAll() {
  document.querySelectorAll('.topic-check').forEach(cb => {
    cb.checked = false;
    cb.closest('.topic-card').classList.remove('selected');
  });
  updateSelectedCount();
}

/* ─── Step 2 → Step 3: Generate Mini-book ─── */
document.getElementById('btn-generate').addEventListener('click', async () => {
  const question   = document.getElementById('question').value.trim();
  const parameters = getParameters();
  const selectedIds    = Array.from(document.querySelectorAll('.topic-check:checked')).map(cb => cb.value);
  const selectedTopics = currentTopics.filter(t => selectedIds.includes(t.id));

  const stopLoading = showLoading(generateMessages);
  try {
    const res  = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, parameters, selectedTopics })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao gerar o mini-livro.');

    currentReportId = data.id;
    renderReader(data.content, question);
    stopLoading();
    goToStep(3);
  } catch (err) { stopLoading(); showError(err.message); }
});

/* ─── Ornamental SVGs ─── */
const SVG_TITLE_ORNAMENT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 22" aria-hidden="true"><line x1="0" y1="11" x2="76" y2="11" stroke="#7c3d28" stroke-width="0.8" opacity="0.22"/><path d="M76,11 C84,4 90,4 95,9 C97,10.5 98.5,11 110,11 C121.5,11 123,10.5 125,9 C130,4 136,4 144,11" stroke="#7c3d28" fill="none" stroke-width="1.1" opacity="0.6"/><circle cx="110" cy="11" r="3.2" fill="#7c3d28" opacity="0.5"/><line x1="144" y1="11" x2="220" y2="11" stroke="#7c3d28" stroke-width="0.8" opacity="0.22"/></svg>`;

const SVG_SECTION_DIVIDER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 18" aria-hidden="true"><line x1="0" y1="9" x2="106" y2="9" stroke="#9a7050" stroke-width="0.7" opacity="0.32"/><polygon points="114,5 118,9 114,13 110,9" fill="#7c3d28" opacity="0.38"/><polygon points="134,4 140,9 134,14 128,9" fill="#7c3d28" opacity="0.65"/><polygon points="166,5 170,9 166,13 162,9" fill="#7c3d28" opacity="0.38"/><line x1="174" y1="9" x2="280" y2="9" stroke="#9a7050" stroke-width="0.7" opacity="0.32"/></svg>`;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ─── Pagination helpers ─── */

function applyOrnaments(container) {
  container.querySelectorAll('h2').forEach(h2 => {
    const ornament = document.createElement('div');
    ornament.className = 'section-ornament';
    ornament.innerHTML = SVG_SECTION_DIVIDER;
    h2.parentNode.insertBefore(ornament, h2);
    const rule = document.createElement('span');
    rule.className = 'section-rule';
    h2.insertAdjacentElement('afterend', rule);
  });
  container.querySelectorAll('hr').forEach(hr => {
    const ornament = document.createElement('div');
    ornament.className = 'hr-ornament';
    ornament.innerHTML = SVG_SECTION_DIVIDER;
    hr.parentNode.replaceChild(ornament, hr);
  });
}

function buildPages(html, question) {
  const coverHtml = `
    <div class="reader-title-block">
      <span class="reader-eyebrow">Biblioteca Expandida · Mini-livro Teológico</span>
      <h1 class="reader-title">${escapeHtml(question)}</h1>
      <div class="reader-title-ornament">${SVG_TITLE_ORNAMENT}</div>
    </div>`;

  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const blocks = Array.from(tmp.children);

  const TARGET = 250;
  const pages = [coverHtml];
  let currentBlocks = [];
  let wordCount = 0;

  blocks.forEach(block => {
    const words = (block.textContent || '').trim().split(/\s+/).filter(w => w.length > 0).length;
    if (words === 0) return;

    const isHeading = /^H[1-3]$/.test(block.nodeName);

    if (wordCount > 0 && wordCount + words > TARGET && !isHeading) {
      const wrapper = document.createElement('div');
      wrapper.className = 'reader-prose';
      currentBlocks.forEach(b => wrapper.appendChild(b.cloneNode(true)));
      pages.push(wrapper.outerHTML);
      currentBlocks = [block.cloneNode(true)];
      wordCount = words;
    } else {
      currentBlocks.push(block.cloneNode(true));
      wordCount += words;
    }
  });

  if (currentBlocks.length > 0) {
    const wrapper = document.createElement('div');
    wrapper.className = 'reader-prose';
    currentBlocks.forEach(b => wrapper.appendChild(b.cloneNode(true)));
    pages.push(wrapper.outerHTML);
  }

  return pages;
}

function showPage(n) {
  const total = paginationState.pages.length;
  n = Math.max(0, Math.min(n, total - 1));
  paginationState.current = n;
  saveProgress(n);

  document.querySelectorAll('.reader-page').forEach((el, i) => {
    el.classList.toggle('reader-page--active', i === n);
  });

  const label = document.getElementById('nav-label');
  const prev  = document.getElementById('nav-prev');
  const next  = document.getElementById('nav-next');
  if (label) label.textContent = `Página ${n + 1} de ${total}`;
  if (prev)  { prev.disabled = (n === 0); prev.onclick = () => showPage(paginationState.current - 1); }
  if (next)  { next.disabled = (n === total - 1); next.onclick = () => showPage(paginationState.current + 1); }
  updateBookmarkButton();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function onReaderKeydown(e) {
  if (!document.getElementById('step-3').classList.contains('active')) return;
  if (e.key === 'ArrowRight') showPage(paginationState.current + 1);
  if (e.key === 'ArrowLeft')  showPage(paginationState.current - 1);
}

async function printReader() {
  if (!currentReportId) { showError('Nenhum relatório carregado.'); return; }

  const btn = document.querySelector('.btn-print');
  btn.textContent = 'Gerando...';
  btn.disabled = true;

  try {
    const res = await fetch(`/api/pdf/${currentReportId}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
      throw new Error(err.error || 'Erro ao gerar PDF.');
    }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = currentReportId + '.pdf';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoga após 2 min — Edge pode abrir no visualizador antes de baixar
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  } catch (err) {
    showError(err.message);
  } finally {
    btn.textContent = '↓ PDF';
    btn.disabled = false;
  }
}

/* ─── Render Reader ─── */
function renderReader(markdownContent, question) {
  marked.setOptions({ breaks: true, gfm: true });
  const html = marked.parse(markdownContent);

  const pages = buildPages(html, question);
  paginationState = { pages, current: 0 };

  const reader = document.getElementById('reader');
  reader.innerHTML = '';

  pages.forEach((pageHtml, i) => {
    const div = document.createElement('div');
    div.className = 'reader-page';
    div.dataset.page = i;
    div.innerHTML = pageHtml;
    if (i > 0) applyOrnaments(div);
    reader.appendChild(div);
  });

  const nav = document.createElement('div');
  nav.className = 'reader-nav';
  nav.id = 'reader-nav';
  nav.innerHTML = `
    <span class="reader-nav-label" id="nav-label">Página 1 de ${pages.length}</span>
    <div class="reader-nav-row">
      <button class="reader-nav-btn" id="nav-prev">← Anterior</button>
      <button class="reader-nav-btn" id="btn-bookmark">☆ Marcar</button>
      <button class="reader-nav-btn" id="nav-next">Próxima →</button>
    </div>
  `;
  reader.appendChild(nav);
  nav.querySelector('#btn-bookmark').addEventListener('click', toggleBookmark);

  showPage(0);

  if (!readerKeydownBound) {
    document.addEventListener('keydown', onReaderKeydown);
    readerKeydownBound = true;
  }
}

/* ─── Reports Screen ─── */
function showReports(show) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  if (show) {
    document.getElementById('reports-screen').classList.add('active');
    loadReports();
  } else {
    document.getElementById('step-1').classList.add('active');
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function loadReports() {
  const list  = document.getElementById('reports-list');
  const empty = document.getElementById('reports-empty');
  list.innerHTML = '';
  list.appendChild(empty);

  try {
    const res  = await fetch('/api/reports');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    const reports = data.reports || [];

    if (reports.length === 0) {
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');
    reports.forEach(r => list.appendChild(buildReportCard(r)));
  } catch (err) {
    showError(err.message);
  }
}

function buildReportCard(report) {
  const topicTags = (report.topics || []).slice(0, 3)
    .map(t => `<span class="tag">${t}</span>`)
    .join('');
  const more = (report.topics || []).length > 3
    ? `<span class="tag">+${report.topics.length - 3}</span>`
    : '';

  const p = report.parameters || {};
  const meta = [
    `${report.topicCount} tópico${report.topicCount !== 1 ? 's' : ''}`,
    p.tone   ? p.tone.charAt(0).toUpperCase() + p.tone.slice(1) : 'Narrativo',
    p.focus  ? p.focus.replace('enfase-', 'Ênfase ').replace('equilibrado', 'Equilibrado') : 'Equilibrado'
  ].join(' · ');

  const saved = loadProgress(report.id);
  const progressBadge = saved && saved.page > 0
    ? `<span class="progress-badge">Página ${saved.page + 1} de ${saved.total}</span>`
    : '';

  const card = document.createElement('div');
  card.className = 'report-card';
  card.innerHTML = `
    <div class="report-card-body">
      <div class="report-date">${formatDate(report.date)}${progressBadge}</div>
      <div class="report-question" title="${report.question}">${report.question}</div>
      <div class="report-meta">${meta}</div>
      <div class="report-topics">${topicTags}${more}</div>
    </div>
    <div class="report-actions">
      <button class="btn-open">${saved && saved.page > 0 ? 'Continuar' : 'Abrir'}</button>
      <button class="btn-delete">Excluir</button>
    </div>`;

  card.querySelector('.btn-open').addEventListener('click', () => openReport(report.id, report.question));
  card.querySelector('.btn-delete').addEventListener('click', () => deleteReport(report.id, card));
  return card;
}

async function openReport(id, question) {
  const stopLoading = showLoading(['Carregando relatório...']);
  try {
    const res  = await fetch(`/api/reports/${id}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    currentReportId = id;
    renderReader(data.content, data.question || question);
    const saved = loadProgress(id);
    if (saved && saved.page > 0) showPage(saved.page);
    stopLoading();
    goToStep(3);
  } catch (err) { stopLoading(); showError(err.message); }
}

async function deleteReport(id, cardEl) {
  if (!confirm('Excluir este relatório permanentemente?')) return;
  try {
    const res = await fetch(`/api/reports/${id}`, { method: 'DELETE' });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
    cardEl.remove();
    const list = document.getElementById('reports-list');
    if (list.querySelectorAll('.report-card').length === 0) {
      document.getElementById('reports-empty').classList.remove('hidden');
    }
  } catch (err) { showError(err.message); }
}
