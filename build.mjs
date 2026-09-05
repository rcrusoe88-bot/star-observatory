// build.mjs — Markdown 内容 + HTML 模板 → dist/ 静态站点（零第三方依赖）
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const root = path.dirname(url.fileURLToPath(import.meta.url));
const outDir = path.join(root, 'dist');

/* ---------- 工具 ---------- */
const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function safeUrl(value, kind) {
  const original = String(value).trim();
  const decoded = original.replace(/&amp;/g, '&');
  const allowed = /^(?:https?:\/\/|\/(?!\/)|\.\.?\/|#)/i.test(decoded) || !/^[a-z][a-z0-9+.-]*:/i.test(decoded);
  if (!allowed) throw new Error(`不安全的${kind} URL：${decoded}`);
  return original;
}

/* ---------- 轻量 Markdown → HTML（支持 ![](src "caption") 插图） ---------- */
function inline(t) {
  t = esc(t);
  t = t.replace(/!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+&quot;([\s\S]*?)&quot;)?\s*\)/g,
    (m, alt, src, cap) => {
      const imageSrc = safeUrl(src, '图片');
      return cap
        ? `<figure><img src="${imageSrc}" alt="${alt}"><figcaption>${cap}</figcaption></figure>`
        : `<figure><img src="${imageSrc}" alt="${alt}"></figure>`;
    });
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    (m, txt, href) => `<a href="${safeUrl(href, '链接')}" target="_blank" rel="noopener">${txt}</a>`);
  t = t.replace(/`([^`]+)`/g, (m, c) => `<code>${c}</code>`);
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return t;
}

function mdToHtml(src) {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  let html = '', i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const lang = (line.match(/^```(\w*)/) || [])[1] || '';
      i++; let code = '';
      while (i < lines.length && !/^```/.test(lines[i])) { code += lines[i] + '\n'; i++; }
      if (i < lines.length) i++;
      html += `<pre><code data-lang="${esc(lang)}">${esc(code)}</code></pre>`;
      continue;
    }
    const hm = line.match(/^(#{1,4})\s+(.*)$/);
    if (hm) { const lv = hm[1].length; html += `<h${lv}>${inline(hm[2])}</h${lv}>`; i++; continue; }
    if (/^---+$/.test(line)) { html += '<hr>'; i++; continue; }
    if (/^>\s?/.test(line)) {
      let q = '';
      while (i < lines.length && /^>\s?/.test(lines[i])) { q += lines[i].replace(/^>\s?/, '') + ' '; i++; }
      html += `<blockquote>${inline(q)}</blockquote>`;
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^[-*]\s+/, '')); i++; }
      html += '<ul>' + items.map(it => `<li>${inline(it)}</li>`).join('') + '</ul>';
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\d+\.\s+/, '')); i++; }
      html += '<ol>' + items.map(it => `<li>${inline(it)}</li>`).join('') + '</ol>';
      continue;
    }
    if (line.trim() === '') { i++; continue; }
    let para = line; i++;
    while (i < lines.length && lines[i].trim() !== '' &&
      !/^(#{1,4}\s|>|[-*]\s|\d+\.\s|```|---+$)/.test(lines[i])) { para += '\n' + lines[i]; i++; }
    html += `<p>${inline(para)}</p>`;
  }
  return html;
}

/* ---------- 解析并校验 frontmatter ---------- */
function parseNote(text, fileName) {
  text = text.replace(/\r\n?/g, '\n');
  const m = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!m) throw new Error(`笔记缺少 frontmatter：${fileName}`);
  const fm = {};
  m[1].split('\n').forEach(line => {
    const mm = line.match(/^([\w-]+):\s*(.*)$/);
    if (mm) fm[mm[1]] = mm[2].trim();
  });
  if (!fm.title) throw new Error(`笔记缺少 title：${fileName}`);
  const dateValue = fm.date || '';
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
    ? new Date(`${dateValue}T00:00:00Z`)
    : null;
  const validDate = parsedDate
    && !Number.isNaN(parsedDate.valueOf())
    && parsedDate.toISOString().slice(0, 10) === dateValue;
  if (!validDate) {
    throw new Error(`笔记 date 必须是真实存在的 YYYY-MM-DD 日期：${fileName}`);
  }
  return { fm, body: text.slice(m[0].length) };
}

/* ---------- 读取笔记 ---------- */
const notesDir = path.join(root, 'notes');
const files = fs.readdirSync(notesDir)
  .filter(f => f.endsWith('.md') && !f.startsWith('.'));
const notes = files.map(fileName => {
  const slug = fileName.replace(/\.md$/, '');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`笔记文件名必须是小写字母、数字和连字符：${fileName}`);
  const { fm, body } = parseNote(fs.readFileSync(path.join(notesDir, fileName), 'utf8'), fileName);
  return { slug, fm, bodyHtml: mdToHtml(body) };
}).sort((a, b) => (b.fm.date || '').localeCompare(a.fm.date || ''));

/* ---------- 渲染片段 ---------- */
function noteIndexCard(n) {
  const meta = [n.fm.date, n.fm.env, n.fm.sample].filter(Boolean)
    .map(x => `<span>${esc(x)}</span>`).join('');
  return `  <a class="note-card" href="notes/${esc(n.slug)}.html">
    <div class="meta">${meta}</div>
    <h3>${esc(n.fm.title || n.slug)}<span class="tag">${esc(n.fm.tag || 'NOTE')}</span></h3>
    <p>${esc(n.fm.summary || '')}</p>
  </a>`;
}
function noteArticle(n) {
  const meta = [n.fm.date, n.fm.env, n.fm.sample, '阅读 5 分钟'].filter(Boolean)
    .map(x => `<span>${esc(x)}</span>`).join('');
  const obs = n.fm.obs
    ? `<div class="obs" style="margin-top:30px;padding:14px 20px;border-left:3px solid var(--accent);background:var(--paper-2);font-style:italic;color:var(--ink-soft);">观察结论 → ${esc(n.fm.obs)}</div>`
    : '';
  return `    <article class="art">
      <a class="back-idx" href="notes.html">← 返回手记索引</a>
      <h1>${esc(n.fm.title || n.slug)}</h1>
      <div class="art-meta">${meta}</div>
      ${n.bodyHtml}
      ${obs}
    </article>`;
}
function homeCard(n) {
  const date = esc(n.fm.date || '');
  const env = esc(n.fm.env || '');
  const sample = esc(n.fm.sample || '');
  const tag = esc(n.fm.tag || 'NOTE');
  const title = esc(n.fm.title || n.slug);
  const summary = esc(n.fm.summary || '');
  const obs = n.fm.obs ? esc(n.fm.obs) : '';
  return `    <a class="flip-card" data-slug="${esc(n.slug)}" href="notes/${esc(n.slug)}.html">
      <div class="flip-inner">
        <div class="flip-front">
          <div class="stamp">
            <span class="date mono">${date}</span>
            ${env ? `<span>${env}</span>` : ''}
            ${sample ? `<span>${sample}</span>` : ''}
          </div>
          <h3>${title}<span class="tag">${tag}</span></h3>
          <p>${summary}</p>
        </div>
        <div class="flip-back">
          ${obs ? `<div class="obs">${obs}</div>` : '<div class="obs" style="opacity:.5;font-style:normal;">暂无观察结论</div>'}
          <div class="flip-meta">
            <span>${env || ''}${env && sample ? ' · ' : ''}${sample || ''}</span>
            <span class="flip-more">阅读全文 →</span>
          </div>
        </div>
      </div>
    </a>`;
}

/* ---------- 生成 dist ---------- */
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.cpSync(path.join(root, 'assets'), path.join(outDir, 'assets'), { recursive: true });

let idxTpl = fs.readFileSync(path.join(root, 'index.template.html'), 'utf8');
idxTpl = idxTpl.split('<!--NOTES_CARDS-->').join(notes.map(homeCard).join('\n'));
fs.writeFileSync(path.join(outDir, 'index.html'), idxTpl);

const notesTpl = fs.readFileSync(path.join(root, 'notes.template.html'), 'utf8');
function renderNotesPage({ title, baseHref = '', content, legacyRedirect = '' }) {
  return notesTpl
    .split('<!--PAGE_TITLE-->').join(esc(title))
    .split('<!--BASE_HREF-->').join(baseHref ? `<base href="${esc(baseHref)}">` : '')
    .split('<!--LEGACY_REDIRECT-->').join(legacyRedirect)
    .split('<!--NOTES_CONTENT-->').join(content);
}

const notesIndexContent = `  <div class="idx-h">
    <span class="fig mono">FIG. 3</span><h2>手记索引</h2>
  </div>
${notes.map(noteIndexCard).join('\n')}`;
const legacyRedirect = `<script>
  (() => {
    const match = location.hash.match(/^#art-([a-z0-9]+(?:-[a-z0-9]+)*)$/);
    if (match) location.replace(\`notes/\${match[1]}.html\`);
  })();
</script>`;
fs.writeFileSync(path.join(outDir, 'notes.html'), renderNotesPage({
  title: '手记座 · Agent 使用手记 — 余小莫星表',
  content: notesIndexContent,
  legacyRedirect,
}));

const noteOutDir = path.join(outDir, 'notes');
fs.mkdirSync(noteOutDir, { recursive: true });
for (const note of notes) {
  fs.writeFileSync(path.join(noteOutDir, `${note.slug}.html`), renderNotesPage({
    title: `${note.fm.title} — 手记座 · 余小莫星表`,
    baseHref: '../',
    content: noteArticle(note),
  }));
}

console.log(`✓ 生成首页、手记索引与 ${notes.length} 个独立手记页面（${notes.map(n => n.slug).join(', ')}）`);
