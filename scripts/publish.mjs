// scripts/publish.mjs — 把 notes/_inbox/ 的笔记发布上线
// 用法：
//   node scripts/publish.mjs           移动 → 构建 → 提交 → 推送（触发 GitHub Actions 重建部署）
//   node scripts/publish.mjs --dry-run 同上，但只提交不推送，用于本地验证
//
// 约定：文件名含"模板"二字、或以 "." 开头的文件会被跳过（如 模板-笔记格式示范.md）。
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const dry = process.argv.includes('--dry-run');
const nodeBin = JSON.stringify(process.execPath); // 用当前 node 运行 build.mjs，避免依赖 PATH 上的 node

const inbox = path.join(root, 'notes', '_inbox');
const notesDir = path.join(root, 'notes');

if (!fs.existsSync(inbox)) {
  console.log('ℹ️ 没有 notes/_inbox/ 目录，无需发布');
  process.exit(0);
}

const pending = fs.readdirSync(inbox).filter(f =>
  f.endsWith('.md') && !f.startsWith('.') && !f.includes('模板'));

if (pending.length === 0) {
  console.log('📭 notes/_inbox/ 没有待发布笔记');
  process.exit(0);
}

// 1) 移入 notes/
for (const f of pending) {
  fs.renameSync(path.join(inbox, f), path.join(notesDir, f));
  console.log(`→ 移入 notes/${f}`);
}

// 2) 构建（重新生成 index.html / notes.html）
execSync(`${nodeBin} build.mjs`, { cwd: root, stdio: 'inherit' });

// 3) 提交
execSync('git add -A notes/ index.html notes.html', { cwd: root, stdio: 'inherit' });
const msg = `notes: 发布 ${pending.length} 篇手记（${pending.join(', ')}）`;
execSync(`git commit -m ${JSON.stringify(msg)}`, { cwd: root, stdio: 'inherit' });

// 4) 推送（或 dry-run 仅留本地提交）
if (dry) {
  console.log('🜲 dry-run：已提交但未推送。撤销用 `git reset --soft HEAD~1`');
} else {
  execSync('git push', { cwd: root, stdio: 'inherit' });
  console.log('✓ 已推送，GitHub Actions 会自动重建并部署 Pages');
}
