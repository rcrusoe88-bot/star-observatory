import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { execFileSync } from 'node:child_process';

// scripts/publish.mjs — 把 notes/_inbox/ 的笔记安全发布上线
// 用法：
//   node scripts/publish.mjs              移动 → 构建 → 精确提交 → 推送
//   node scripts/publish.mjs --no-push    提交但不推送，适合本地检查
//   node scripts/publish.mjs --dry-run    --no-push 的兼容别名（历史行为）
//
// 约定：文件名含“模板”二字、或以“.”开头的文件会被跳过。

const scriptDir = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const args = process.argv.slice(2);
const noPush = args.includes('--no-push') || args.includes('--dry-run');
const inbox = path.join(root, 'notes', '_inbox');
const notesDir = path.join(root, 'notes');
const pending = fs.existsSync(inbox)
  ? fs.readdirSync(inbox).filter(f => f.endsWith('.md') && !f.startsWith('.') && !f.includes('模板'))
  : [];

function git(args, options = {}) {
  return execFileSync('git', args, { cwd: root, stdio: 'inherit', ...options });
}
function fail(message) {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
}

if (!fs.existsSync(inbox)) {
  console.log('ℹ️ 没有 notes/_inbox/ 目录，无需发布');
  process.exit(0);
}
if (pending.length === 0) {
  console.log('📭 notes/_inbox/ 没有待发布笔记');
  process.exit(0);
}

const allowedInboxPaths = new Set(pending.map(file => `notes/_inbox/${file}`));
const dirtyEntries = execFileSync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], { cwd: root, encoding: 'utf8' })
  .split('\0').filter(Boolean);
const dirtyLines = dirtyEntries.filter(entry => !allowedInboxPaths.has(entry.slice(3).replace(/\\/g, '/')));
if (dirtyLines.length) {
  fail('工作区存在未提交修改。请先提交或清理修改，再运行发布，避免覆盖其他工作。');
  process.exit(1);
}
for (const file of pending) {
  const source = path.join(inbox, file);
  const destination = path.join(notesDir, file);
  if (fs.existsSync(destination)) {
    fail(`目标笔记已存在，已停止发布：notes/${file}`);
    process.exit(1);
  }
}

const trackedInboxFiles = new Set(pending.filter(file => {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', '--', `notes/_inbox/${file}`], { cwd: root, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}));
const moved = [];
let committed = false;
try {
  for (const file of pending) {
    const source = path.join(inbox, file);
    const destination = path.join(notesDir, file);
    fs.renameSync(source, destination);
    moved.push({ file, source, destination });
    console.log(`→ 移入 notes/${file}`);
  }

  execFileSync(process.execPath, ['build.mjs'], { cwd: root, stdio: 'inherit' });

  const paths = moved.flatMap(({ file }) => [
    ...(trackedInboxFiles.has(file) ? [`notes/_inbox/${file}`] : []),
    `notes/${file}`
  ]);
  git(['add', '--', ...paths]);
  const message = `notes: 发布 ${pending.length} 篇手记（${pending.join(', ')}）`;
  git(['commit', '-m', message]);
  committed = true;

  if (noPush) {
    console.log('🜲 已提交但未推送。需要发布时运行 `git push`。');
  } else {
    git(['push']);
    console.log('✓ 已推送，GitHub Actions 会自动构建并部署 Pages');
  }
} catch (error) {
  if (!committed) {
    for (const { source, destination } of [...moved].reverse()) {
      if (fs.existsSync(destination) && !fs.existsSync(source)) fs.renameSync(destination, source);
    }
    console.error('↩️ 提交前步骤失败，已将笔记退回 notes/_inbox/。');
  } else {
    console.error('⚠️ 本地提交已完成，但推送失败；笔记和提交已保留，请稍后重试 `git push`。');
  }
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
