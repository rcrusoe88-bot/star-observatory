import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { execFileSync } from 'node:child_process';

const scriptDir = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const dist = path.join(root, 'dist');
execFileSync(process.execPath, ['build.mjs'], { cwd: root, stdio: 'inherit' });

const readDist = relativePath => fs.readFileSync(path.join(dist, relativePath), 'utf8');
const index = readDist('index.html');
const notesIndex = readDist('notes.html');
const noteFiles = fs.readdirSync(path.join(root, 'notes'))
  .filter(file => file.endsWith('.md') && !file.startsWith('.'));
const slugs = noteFiles.map(file => file.replace(/\.md$/, ''));
const notePages = slugs.map(slug => ({
  relativePath: `notes/${slug}.html`,
  html: readDist(`notes/${slug}.html`),
}));
const generatedPages = [
  { relativePath: 'index.html', html: index },
  { relativePath: 'notes.html', html: notesIndex },
  ...notePages,
];

for (const { relativePath, html } of generatedPages) {
  if (/<!--(?:NOTES_|PAGE_TITLE|BASE_HREF|LEGACY_REDIRECT)/.test(html)) {
    throw new Error(`生成结果仍包含未替换的内容占位符：dist/${relativePath}`);
  }
  if (/\b(?:href|src)="(?:javascript|data):/i.test(html)) {
    throw new Error(`生成结果包含不安全的 javascript/data URL：dist/${relativePath}`);
  }
}

const indexCardCount = (notesIndex.match(/<a\s+class="note-card"/g) || []).length;
if (indexCardCount !== noteFiles.length) {
  throw new Error(`手记索引数量不一致：生成 ${indexCardCount} 条，源文件 ${noteFiles.length} 篇`);
}
if (/<article\b/.test(notesIndex)) {
  throw new Error('手记索引不应再内嵌文章正文');
}
for (const { relativePath, html } of notePages) {
  const articleCount = (html.match(/<article\s+class="art"/g) || []).length;
  if (articleCount !== 1) throw new Error(`独立手记页面应只包含一篇正文：dist/${relativePath}`);
  if (!/<base href="\.\.\/">/.test(html)) throw new Error(`独立手记页面缺少站点根路径基准：dist/${relativePath}`);
}

const drawBlock = index.match(/function draw\(now\)\{([\s\S]*?)\r?\n\}\r?\nif \(prefersReducedMotion\) draw/);
if (!drawBlock?.[1].includes('scheduleConstellationFrame();')) {
  throw new Error('星座画布缺少可见状态下的连续帧调度');
}
const galaxyFrameBlock = index.match(/function frame\(t\)\{([\s\S]*?)\r?\n  \}\r?\n  if \(prefersReducedMotion\) frame/);
if (!galaxyFrameBlock?.[1].includes('scheduleGalaxyFrame();')) {
  throw new Error('WebGL 星空缺少可见状态下的连续帧调度');
}

console.log(`✓ 内容站点自检通过：${noteFiles.length} 篇独立手记，产物位于 dist/`);
