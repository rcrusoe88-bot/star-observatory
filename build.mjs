// build.mjs — 余小莫的星空观察台 · 零依赖静态生成器
// 读取 notes/*.md → 注入 index.template.html / notes.template.html → 写出 index.html / notes.html
// 运行：node build.mjs   （无需 npm install；CI 构建命令填 node build.mjs 即可）
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dir = path.dirname(url.fileURLToPath(import.meta.url));
const root = __dir;

/* ---------- 工具 ---------- */
const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');
const pad = n => String(n).padStart(2, '0');
const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/* ---------- 轻量 Markdown → HTML（支持 ![](src "caption") 插图） ---------- */
function inline(t) {
  t = esc(t);
  // 图片：![alt](src) 或 ![alt](src "caption") → figure / figure+figcaption
  // 注意：本函数先 esc() 全文，故 caption 的引号已成 &quot;，这里按 &quot; 匹配
  t = t.replace(/!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+&quot;([\s\S]*?)&quot;)?\s*\)/g,
    (m, alt, src, cap) => cap
      ? `<figure><img src="${src}" alt="${alt}"><figcaption>${cap}</figcaption></figure>`
      : `<figure><img src="${src}" alt="${alt}"></figure>`);
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    (m, txt, href) => `<a href="${href}" target="_blank" rel="noopener">${txt}</a>`);
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
      i++;
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

/* ---------- 解析 frontmatter ---------- */
function parseNote(text) {
  text = text.replace(/\r\n?/g, '\n');
  const m = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  let fm = {}, body = text;
  if (m) {
    body = text.slice(m[0].length);
    m[1].split('\n').forEach(l => {
      const mm = l.match(/^([\w-]+):\s*(.*)$/);
      if (mm) fm[mm[1]] = mm[2].trim();
    });
  }
  return { fm, body };
}

/* ---------- 读取笔记 ---------- */
const notesDir = path.join(root, 'notes');
const files = fs.readdirSync(notesDir)
  .filter(f => f.endsWith('.md') && !f.startsWith('.'));
const notes = files.map(f => {
  const slug = f.replace(/\.md$/, '');
  const { fm, body } = parseNote(fs.readFileSync(path.join(notesDir, f), 'utf8'));
  return { slug, fm, bodyHtml: mdToHtml(body) };
}).sort((a, b) => (b.fm.date || '').localeCompare(a.fm.date || ''));

/* ---------- 渲染片段 ---------- */
function noteIndexCard(n) {
  const meta = [n.fm.date, n.fm.env, n.fm.sample].filter(Boolean)
    .map(x => `<span>${esc(x)}</span>`).join('');
  return `  <a class="note-card" href="#art-${esc(n.slug)}">
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
  return `    <article id="art-${esc(n.slug)}" class="art" style="margin-top:60px;">
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
  return `    <a class="note" href="notes.html#art-${esc(n.slug)}">
      <div class="stamp"><div class="date mono">${date}</div>${env ? `<div>${env}</div>` : ''}${sample ? `<div>${sample}</div>` : ''}</div>
      <div>
        <h3>${esc(n.fm.title || n.slug)}</h3>
        <p>${esc(n.fm.summary || '')}</p>
        ${n.fm.obs ? `<div class="obs">${esc(n.fm.obs)}</div>` : ''}
      </div>
    </a>`;
}

/* ---------- 注入模板 ---------- */
let idxTpl = fs.readFileSync(path.join(root, 'index.template.html'), 'utf8');
idxTpl = idxTpl.split('<!--NOTES_CARDS-->').join(notes.map(homeCard).join('\n'));
fs.writeFileSync(path.join(root, 'index.html'), idxTpl);

let notesTpl = fs.readFileSync(path.join(root, 'notes.template.html'), 'utf8');
notesTpl = notesTpl.split('<!--NOTES_INDEX-->').join(notes.map(noteIndexCard).join('\n'));
notesTpl = notesTpl.split('<!--NOTES_ARTICLES-->').join(notes.map(noteArticle).join('\n'));
fs.writeFileSync(path.join(root, 'notes.html'), notesTpl);

console.log(`✓ 生成 index.html + notes.html（${notes.length} 篇手记：${notes.map(n => n.slug).join(', ')}）`);
