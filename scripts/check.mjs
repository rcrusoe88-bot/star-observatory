import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { execFileSync } from 'node:child_process';

const scriptDir = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const dist = path.join(root, 'dist');
execFileSync(process.execPath, ['build.mjs'], { cwd: root, stdio: 'inherit' });

const index = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const notes = fs.readFileSync(path.join(dist, 'notes.html'), 'utf8');
const noteFiles = fs.readdirSync(path.join(root, 'notes'))
  .filter(file => file.endsWith('.md') && !file.startsWith('.'));
const articleCount = (notes.match(/<article\s+id="art-/g) || []).length;

if (index.includes('<!--NOTES_') || notes.includes('<!--NOTES_')) {
  throw new Error('生成结果仍包含未替换的内容占位符');
}
if (articleCount !== noteFiles.length) {
  throw new Error(`文章数量不一致：生成 ${articleCount} 篇，源文件 ${noteFiles.length} 篇`);
}
if (/\b(?:href|src)="(?:javascript|data):/i.test(`${index}\n${notes}`)) {
  throw new Error('生成结果包含不安全的 javascript/data URL');
}
const drawBlock = index.match(/function draw\(now\)\{([\s\S]*?)\r?\n\}\r?\nif \(prefersReducedMotion\) draw/);
if (!drawBlock?.[1].includes('scheduleConstellationFrame();')) {
  throw new Error('星座画布缺少可见状态下的连续帧调度');
}
const galaxyFrameBlock = index.match(/function frame\(t\)\{([\s\S]*?)\r?\n  \}\r?\n  if \(prefersReducedMotion\) frame/);
if (!galaxyFrameBlock?.[1].includes('scheduleGalaxyFrame();')) {
  throw new Error('WebGL 星空缺少可见状态下的连续帧调度');
}
for (const file of ['index.html', 'notes.html']) {
  if (!fs.existsSync(path.join(dist, file))) throw new Error(`缺少构建产物：dist/${file}`);
}
console.log(`✓ 内容站点自检通过：${noteFiles.length} 篇手记，产物位于 dist/`);
